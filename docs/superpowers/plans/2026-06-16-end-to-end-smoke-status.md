# End-to-End Smoke Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give new users a simple way to verify that the local helper is running and that a simulated Claude Code hook can create a pending request.

**Architecture:** Add a read-only `/status` endpoint to the existing Node helper. Add a small Node smoke script that runs the existing Claude Code hook bridge with a synthetic `PermissionRequest`, then reads `/status` to confirm helper visibility. Keep the iPhone and Watch code unchanged.

**Tech Stack:** Node.js built-in HTTP server, Node.js built-in test runner, existing helper API, existing Claude Code hook bridge script.

---

## File Structure

- `src/helper/requestStore.js`: add a read-only `summary()` method for request counts.
- `src/helper/server.js`: add unauthenticated `GET /status` returning helper status and request counts.
- `test/server.test.js`: verify `/status` reports `authRequired` and request counts.
- `scripts/smoke-claude-code.js`: create a synthetic Claude Code hook payload, run `scripts/claude-code-hook.js`, then print status.
- `test/smokeClaudeCodeScript.test.js`: verify the smoke script posts through the hook bridge with bearer auth.
- `package.json`: add `smoke:claude-code`.
- `README.md`: add a 5-minute local verification flow.

---

### Task 1: Helper Status Endpoint

**Files:**
- Modify: `src/helper/requestStore.js`
- Modify: `src/helper/server.js`
- Modify: `test/server.test.js`

- [ ] **Step 1: Write failing `/status` test**

Add this test to `test/server.test.js` after the invalid payload test:

```js
test("reports helper status and request counts", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const statusBeforeResponse = await fetch(`${baseUrl}/status`);
    const statusBefore = await statusBeforeResponse.json();

    assert.equal(statusBeforeResponse.status, 200);
    assert.equal(statusBefore.ok, true);
    assert.equal(statusBefore.service, "agents-in-watch-helper");
    assert.equal(statusBefore.authRequired, true);
    assert.equal(statusBefore.requests.pending, 0);
    assert.equal(statusBefore.requests.resolved, 0);
    assert.equal(statusBefore.requests.total, 0);

    const sessionResponse = await fetch(`${baseUrl}/pairing/sessions`, { method: "POST" });
    const session = await sessionResponse.json();
    const claimResponse = await fetch(`${baseUrl}/pairing/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: session.code, deviceName: "Smoke iPhone" }),
    });
    const claim = await claimResponse.json();
    const approveResponse = await fetch(`${baseUrl}/pairing/claims/${claim.id}/approve`, {
      method: "POST",
    });
    const approved = await approveResponse.json();

    const createResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${approved.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        agentType: "claude-code",
        projectName: "payments-api",
        computerName: "work-mac",
        sessionId: "session-1",
        requestType: "approval",
        title: "Allow command",
        watchSummary: "Claude wants to run pnpm test",
        phoneContext: "Command: pnpm test",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    });
    const created = await createResponse.json();

    const statusPendingResponse = await fetch(`${baseUrl}/status`);
    const statusPending = await statusPendingResponse.json();
    assert.equal(statusPending.requests.pending, 1);
    assert.equal(statusPending.requests.resolved, 0);
    assert.equal(statusPending.requests.total, 1);

    await fetch(`${baseUrl}/requests/${created.id}/response`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${approved.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ action: "allow" }),
    });

    const statusResolvedResponse = await fetch(`${baseUrl}/status`);
    const statusResolved = await statusResolvedResponse.json();
    assert.equal(statusResolved.requests.pending, 0);
    assert.equal(statusResolved.requests.resolved, 1);
    assert.equal(statusResolved.requests.total, 1);
  } finally {
    await close(app);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/server.test.js
```

Expected: fail because `/status` returns `404`.

- [ ] **Step 3: Add request summary**

Add this method to the object returned by `createRequestStore()`:

```js
summary() {
  const allRequests = [...requests.values()];
  return {
    pending: allRequests.filter((request) => request.status === "pending").length,
    resolved: allRequests.filter((request) => request.status === "resolved").length,
    total: allRequests.length,
  };
},
```

- [ ] **Step 4: Add `/status` route**

In `src/helper/server.js`, handle `GET /status` before authenticated routes:

```js
if (request.method === "GET" && request.url === "/status") {
  return sendJson(response, 200, {
    ok: true,
    service: "agents-in-watch-helper",
    authRequired,
    requests: store.summary(),
  });
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- test/server.test.js
```

Expected: all server tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/helper/requestStore.js src/helper/server.js test/server.test.js
git commit -m "feat: add helper status endpoint"
```

---

### Task 2: Claude Code Smoke Script

**Files:**
- Create: `scripts/smoke-claude-code.js`
- Create: `test/smokeClaudeCodeScript.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing smoke script test**

Create `test/smokeClaudeCodeScript.test.js`:

```js
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("smoke script creates a Claude Code request through the hook bridge", async () => {
  const receivedBodies = [];
  const fakeHelper = http.createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/status") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          ok: true,
          service: "agents-in-watch-helper",
          authRequired: true,
          requests: {
            pending: receivedBodies.length,
            resolved: 0,
            total: receivedBodies.length,
          },
        })
      );
      return;
    }

    if (request.method === "POST" && request.url === "/requests") {
      assert.equal(request.headers.authorization, "Bearer smoke-token");
      const chunks = [];
      for await (const chunk of request) {
        chunks.push(chunk);
      }
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      receivedBodies.push(body);
      response.writeHead(201, { "content-type": "application/json" });
      response.end(JSON.stringify({ ...body, id: "request-1", status: "pending" }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runSmokeScript({
      env: {
        AGENTS_IN_WATCH_HELPER_URL: helperUrl,
        AGENTS_IN_WATCH_TOKEN: "smoke-token",
        COMPUTER_NAME: "work-mac",
      },
    });

    assert.equal(result.code, 0);
    assert.equal(receivedBodies.length, 1);
    assert.equal(receivedBodies[0].agentType, "claude-code");
    assert.equal(receivedBodies[0].requestType, "approval");
    assert.match(result.stdout, /Smoke request created/);
    assert.match(result.stdout, /Pending requests: 1/);
  } finally {
    await close(fakeHelper);
  }
});

function runSmokeScript({ env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/smoke-claude-code.js"], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(`http://${address.address}:${address.port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- test/smokeClaudeCodeScript.test.js
```

Expected: fail because `scripts/smoke-claude-code.js` does not exist.

- [ ] **Step 3: Create smoke script**

Create `scripts/smoke-claude-code.js`:

```js
#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const helperUrl = process.env.AGENTS_IN_WATCH_HELPER_URL ?? "http://127.0.0.1:42731";
const hookScriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "claude-code-hook.js");

try {
  const before = await readStatus();
  const payload = {
    hook_event_name: "PermissionRequest",
    session_id: "smoke-test",
    cwd: process.cwd(),
    tool_name: "Bash",
    tool_input: { command: "pnpm test" },
    permission_request: { reason: "Manual Agents in Watch smoke test." },
  };

  const hookResult = await runHookScript(JSON.stringify(payload));
  if (hookResult.code !== 0) {
    throw new Error(`hook bridge failed: ${hookResult.stderr || hookResult.stdout}`);
  }

  const after = await readStatus();
  console.log("Smoke request created.");
  console.log(`Helper: ${helperUrl}`);
  console.log(`Pending requests: ${after.requests.pending}`);
  console.log(`Total requests: ${after.requests.total}`);

  if (after.requests.total <= before.requests.total) {
    throw new Error("helper status did not show a new request");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function readStatus() {
  const response = await fetch(`${helperUrl}/status`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`helper status failed: ${response.status} ${body}`);
  }
  return response.json();
}

function runHookScript(input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [hookScriptPath], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}
```

- [ ] **Step 4: Add package script**

Add this entry to `package.json` under `scripts`:

```json
"smoke:claude-code": "node scripts/smoke-claude-code.js"
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- test/smokeClaudeCodeScript.test.js
```

Expected: smoke script test passes.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/smoke-claude-code.js test/smokeClaudeCodeScript.test.js
git commit -m "feat: add Claude Code smoke test script"
```

---

### Task 3: Five-Minute Verification Docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Add a `Five-Minute Local Verification` section after the `Run` section. Include these steps:

```markdown
## Five-Minute Local Verification

Use this flow to prove the desktop side can receive a Claude Code-style request before opening Xcode:

1. Start the helper:

```bash
npm start
```

2. In another terminal, create and approve a pairing token using the `Pair a Device` commands below.

3. Export the token and helper URL:

```bash
export AGENTS_IN_WATCH_TOKEN=PASTE_TOKEN_HERE
export AGENTS_IN_WATCH_HELPER_URL=http://127.0.0.1:42731
export COMPUTER_NAME="$(hostname)"
```

4. Run the smoke test:

```bash
npm run smoke:claude-code
```

5. Check helper status:

```bash
curl http://127.0.0.1:42731/status
```

The smoke test creates a synthetic Claude Code `PermissionRequest`. If it succeeds, the helper has at least one pending request ready for the iPhone companion to fetch and forward to the Watch.
```

Also update the current capability list to mention helper status and smoke verification.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
swift test
plutil -lint mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatchWatch.xcscheme
```

Expected: all commands pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add local smoke verification flow"
```

---

## Self-Review

- Spec coverage: implements the chosen A path: helper status, CLI smoke verification, and README verification flow.
- Placeholder scan: no unresolved `TBD` or `TODO` language.
- Scope check: does not implement Apple notifications, Codex desktop adapter, installers, QR scanning, or background retry queues.
- Type consistency: request count fields are `pending`, `resolved`, and `total` in tests, endpoint, and docs.
