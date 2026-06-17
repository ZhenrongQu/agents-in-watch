# Codex Desktop Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe Codex Desktop JSON event adapter that creates helper pending requests without relying on fragile desktop UI automation.

**Architecture:** Mirror the existing Claude Code bridge: a pure translator converts stdin JSON into the shared request model, a script posts the translated request to `/requests`, and a smoke script proves a synthetic Codex request reaches the helper. iPhone, Watch, helper storage, pairing, and response APIs remain unchanged.

**Tech Stack:** Node.js ESM, Node built-in test runner, Node `fetch`, local helper HTTP API, existing shared request model.

---

## File Structure

- Create `src/adapters/codexDesktopHook.js`: pure translator from Codex event contract to `normalizeAgentRequest`.
- Create `test/codexDesktopHook.test.js`: translator unit tests.
- Create `scripts/codex-desktop-hook.js`: stdin JSON command bridge that posts translated requests to the helper.
- Create `test/codexDesktopHookScript.test.js`: script tests with fake helper server.
- Create `scripts/smoke-codex-desktop.js`: local smoke test using the Codex event contract.
- Create `test/smokeCodexDesktopScript.test.js`: smoke-script test with fake helper status/request endpoints.
- Modify `package.json`: add `smoke:codex-desktop`.
- Modify `README.md`: document Codex adapter scope, event JSON contract, and smoke-test command.

---

### Task 1: Codex Desktop Translator

**Files:**
- Create: `src/adapters/codexDesktopHook.js`
- Create: `test/codexDesktopHook.test.js`

- [ ] **Step 1: Write failing translator tests**

Create `test/codexDesktopHook.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { translateCodexDesktopHook } from "../src/adapters/codexDesktopHook.js";

test("translates a Codex approval event into an approval request", () => {
  const request = translateCodexDesktopHook(
    {
      event: "approval_request",
      sessionId: "session-1",
      cwd: "/Users/me/projects/payments-api",
      toolName: "shell",
      command: "npm test",
      reason: "Codex wants to verify the changes.",
    },
    { computerName: "work-mac" }
  );

  assert.equal(request.agentType, "codex-desktop");
  assert.equal(request.projectName, "payments-api");
  assert.equal(request.computerName, "work-mac");
  assert.equal(request.sessionId, "session-1");
  assert.equal(request.requestType, "approval");
  assert.equal(request.title, "Allow shell");
  assert.equal(request.watchSummary, "Codex wants to run: npm test");
  assert.match(request.phoneContext, /Codex wants to verify the changes/);
  assert.deepEqual(request.actions, ["allow", "deny", "pause"]);
  assert.equal(request.riskLevel, "low");
});

test("translates a Codex notification event into a notification request", () => {
  const request = translateCodexDesktopHook(
    {
      event: "notification",
      sessionId: "session-2",
      cwd: "/Users/me/projects/site",
      message: "Codex is waiting for input.",
    },
    { computerName: "work-mac" }
  );

  assert.equal(request.agentType, "codex-desktop");
  assert.equal(request.projectName, "site");
  assert.equal(request.sessionId, "session-2");
  assert.equal(request.requestType, "notification");
  assert.equal(request.title, "Codex Desktop notification");
  assert.equal(request.watchSummary, "Codex is waiting for input.");
  assert.deepEqual(request.actions, ["open-phone", "pause"]);
  assert.equal(request.riskLevel, "low");
});

test("rejects unsupported Codex events", () => {
  assert.throws(
    () => translateCodexDesktopHook({ event: "unknown_event" }),
    /unsupported Codex Desktop event: unknown_event/
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test test/codexDesktopHook.test.js
```

Expected: fail because `src/adapters/codexDesktopHook.js` does not exist.

- [ ] **Step 3: Implement the translator**

Create `src/adapters/codexDesktopHook.js`:

```js
import path from "node:path";
import { normalizeAgentRequest } from "../shared/requestModel.js";

export function translateCodexDesktopHook(payload, options = {}) {
  const eventName = payload.event ?? payload.eventName;
  const computerName = options.computerName ?? "local-computer";
  const projectName = projectNameFromCwd(payload.cwd);
  const sessionId = payload.sessionId ?? payload.session_id ?? "unknown-session";

  if (eventName === "approval_request" || eventName === "approval-request") {
    const toolName = payload.toolName ?? payload.tool_name ?? "tool";
    const command = payload.command;
    const actionText = typeof command === "string" && command.trim() !== ""
      ? `run: ${command}`
      : `use ${toolName}`;
    const reason = payload.reason ?? "Codex Desktop is requesting approval.";

    return normalizeAgentRequest({
      agentType: "codex-desktop",
      projectName,
      computerName,
      sessionId,
      requestType: "approval",
      title: `Allow ${toolName}`,
      watchSummary: `Codex wants to ${actionText}`,
      phoneContext: [
        `Event: ${eventName}`,
        `Tool: ${toolName}`,
        command ? `Command: ${command}` : "",
        `Reason: ${reason}`,
      ]
        .filter(Boolean)
        .join("\n"),
      actions: ["allow", "deny", "pause"],
      riskLevel: riskLevelForApproval(payload),
    });
  }

  if (eventName === "notification") {
    const message = payload.message ?? "Codex Desktop needs attention.";

    return normalizeAgentRequest({
      agentType: "codex-desktop",
      projectName,
      computerName,
      sessionId,
      requestType: "notification",
      title: "Codex Desktop notification",
      watchSummary: message,
      phoneContext: `Event: ${eventName}\n${message}`,
      actions: ["open-phone", "pause"],
      riskLevel: "low",
    });
  }

  throw new Error(`unsupported Codex Desktop event: ${eventName}`);
}

function projectNameFromCwd(cwd) {
  if (typeof cwd !== "string" || cwd.trim() === "") {
    return "unknown-project";
  }

  return path.basename(cwd);
}

function riskLevelForApproval(payload) {
  const command = payload.command;

  if (typeof command !== "string") {
    return "medium";
  }

  if (/\brm\b|\bsudo\b|\bchmod\b|\bcurl\b.*\|\s*(sh|bash)/.test(command)) {
    return "high";
  }

  return "low";
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/codexDesktopHook.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/codexDesktopHook.js test/codexDesktopHook.test.js
git commit -m "feat: add Codex desktop event translator"
```

---

### Task 2: Codex Desktop Hook Script

**Files:**
- Create: `scripts/codex-desktop-hook.js`
- Create: `test/codexDesktopHookScript.test.js`

- [ ] **Step 1: Write failing script tests**

Create `test/codexDesktopHookScript.test.js`:

```js
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("Codex hook script posts translated requests to helper", async () => {
  const receivedBodies = [];
  const fakeHelper = http.createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
    }
    receivedBodies.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runHookScript({
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl, COMPUTER_NAME: "work-mac" },
      input: JSON.stringify({
        event: "approval_request",
        sessionId: "session-1",
        cwd: "/Users/me/projects/payments-api",
        toolName: "shell",
        command: "npm test",
      }),
    });

    assert.equal(result.code, 0);
    assert.equal(receivedBodies.length, 1);
    assert.equal(receivedBodies[0].agentType, "codex-desktop");
    assert.equal(receivedBodies[0].watchSummary, "Codex wants to run: npm test");
  } finally {
    await close(fakeHelper);
  }
});

test("Codex hook script includes bearer token when configured", async () => {
  const receivedHeaders = [];
  const fakeHelper = http.createServer(async (request, response) => {
    receivedHeaders.push(request.headers);
    for await (const _ of request) {
      // Drain request body.
    }
    response.writeHead(201, { "content-type": "application/json" });
    response.end(JSON.stringify({ ok: true }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runHookScript({
      env: {
        AGENTS_IN_WATCH_HELPER_URL: helperUrl,
        AGENTS_IN_WATCH_TOKEN: "token-123",
        COMPUTER_NAME: "work-mac",
      },
      input: JSON.stringify({
        event: "notification",
        sessionId: "session-2",
        cwd: "/Users/me/projects/site",
        message: "Codex is waiting for input.",
      }),
    });

    assert.equal(result.code, 0);
    assert.equal(receivedHeaders[0].authorization, "Bearer token-123");
  } finally {
    await close(fakeHelper);
  }
});

test("Codex hook script reports helper rejection details", async () => {
  const fakeHelper = http.createServer(async (_request, response) => {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "missing bearer token" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runHookScript({
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl, COMPUTER_NAME: "work-mac" },
      input: JSON.stringify({
        event: "approval_request",
        sessionId: "session-1",
        cwd: "/Users/me/projects/payments-api",
        toolName: "shell",
        command: "npm test",
      }),
    });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /helper rejected request: 401/);
    assert.match(result.stderr, /missing bearer token/);
  } finally {
    await close(fakeHelper);
  }
});

function runHookScript({ env, input }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/codex-desktop-hook.js"], {
      env: { ...process.env, ...env },
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

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test test/codexDesktopHookScript.test.js
```

Expected: fail because `scripts/codex-desktop-hook.js` does not exist.

- [ ] **Step 3: Implement script**

Create `scripts/codex-desktop-hook.js`:

```js
#!/usr/bin/env node
import { translateCodexDesktopHook } from "../src/adapters/codexDesktopHook.js";

const helperUrl = process.env.AGENTS_IN_WATCH_HELPER_URL ?? "http://127.0.0.1:42731";
const computerName = process.env.COMPUTER_NAME ?? "local-computer";

try {
  const payload = JSON.parse(await readStdin());
  const request = translateCodexDesktopHook(payload, { computerName });
  const headers = { "content-type": "application/json" };
  const token = process.env.AGENTS_IN_WATCH_TOKEN;
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${helperUrl}/requests`, {
    method: "POST",
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`helper rejected request: ${response.status} ${body}`);
  }

  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

async function readStdin() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf8");
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
node --test test/codexDesktopHookScript.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/codex-desktop-hook.js test/codexDesktopHookScript.test.js
git commit -m "feat: add Codex desktop hook script"
```

---

### Task 3: Codex Desktop Smoke Script

**Files:**
- Create: `scripts/smoke-codex-desktop.js`
- Create: `test/smokeCodexDesktopScript.test.js`
- Modify: `package.json`

- [ ] **Step 1: Write failing smoke-script test**

Create `test/smokeCodexDesktopScript.test.js`:

```js
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("smoke script creates a Codex Desktop request through the hook bridge", async () => {
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
    assert.equal(receivedBodies[0].agentType, "codex-desktop");
    assert.equal(receivedBodies[0].requestType, "approval");
    assert.match(result.stdout, /Codex smoke request created/);
    assert.match(result.stdout, /Pending requests: 1/);
  } finally {
    await close(fakeHelper);
  }
});

function runSmokeScript({ env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/smoke-codex-desktop.js"], {
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
node --test test/smokeCodexDesktopScript.test.js
```

Expected: fail because `scripts/smoke-codex-desktop.js` does not exist.

- [ ] **Step 3: Implement smoke script**

Create `scripts/smoke-codex-desktop.js`:

```js
#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const helperUrl = process.env.AGENTS_IN_WATCH_HELPER_URL ?? "http://127.0.0.1:42731";
const hookScriptPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "codex-desktop-hook.js"
);

try {
  const before = await readStatus();
  const payload = {
    event: "approval_request",
    sessionId: "codex-smoke-test",
    cwd: process.cwd(),
    toolName: "shell",
    command: "npm test",
    reason: "Manual Agents in Watch Codex smoke test.",
  };

  const hookResult = await runHookScript(JSON.stringify(payload));
  if (hookResult.code !== 0) {
    throw new Error(`Codex hook bridge failed: ${hookResult.stderr || hookResult.stdout}`);
  }

  const after = await readStatus();
  console.log("Codex smoke request created.");
  console.log(`Helper: ${helperUrl}`);
  console.log(`Pending requests: ${after.requests.pending}`);
  console.log(`Total requests: ${after.requests.total}`);

  if (after.requests.total <= before.requests.total) {
    throw new Error("helper status did not show a new Codex request");
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

- [ ] **Step 4: Add npm script**

Modify `package.json` scripts to include:

```json
"smoke:codex-desktop": "node scripts/smoke-codex-desktop.js"
```

Keep the existing `start`, `smoke:claude-code`, and `test` scripts unchanged.

- [ ] **Step 5: Run focused smoke tests**

Run:

```bash
node --test test/smokeCodexDesktopScript.test.js
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/smoke-codex-desktop.js test/smokeCodexDesktopScript.test.js
git commit -m "feat: add Codex desktop smoke test"
```

---

### Task 4: README Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update feature list**

In `README.md`, add a feature bullet near the Claude Code bullet:

```md
- Translate Codex Desktop-style JSON events into the shared request model.
```

Also update the limitations sentence to include:

```md
It does not yet include packaged desktop installers, automatic Codex Desktop UI control, notification action buttons, or background retry queues.
```

- [ ] **Step 2: Add Codex Desktop Adapter section**

Add this section after the "Claude Code Hook Bridge" section:

````md
## Codex Desktop Adapter

The Codex adapter is a safe local JSON bridge for MVP testing. It does not click Codex Desktop UI or automatically apply Watch responses back into a live Codex session yet.

Export the helper settings:

```bash
export AGENTS_IN_WATCH_TOKEN=PASTE_TOKEN_HERE
export AGENTS_IN_WATCH_HELPER_URL=http://127.0.0.1:42731
export COMPUTER_NAME="$(hostname)"
```

Create a Codex-style approval request:

```bash
printf '%s\n' '{
  "event": "approval_request",
  "sessionId": "manual-codex-smoke-test",
  "cwd": "'$PWD'",
  "toolName": "shell",
  "command": "npm test",
  "reason": "Manual Agents in Watch Codex smoke test."
}' | scripts/codex-desktop-hook.js
```

Or run the packaged smoke test:

```bash
npm run smoke:codex-desktop
```

If the command exits with `0`, open the iPhone app. The foreground auto-refresh loop should pick up the Codex request and publish it to the Watch when WatchConnectivity is ready.
````

- [ ] **Step 3: Run README-related verification**

Run:

```bash
npm test
```

Expected: all Node tests pass.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document Codex desktop adapter"
```

---

### Task 5: Final Verification and Integration

**Files:**
- No new files.

- [ ] **Step 1: Run full Node tests**

Run:

```bash
npm test
```

Expected: all Node tests pass.

- [ ] **Step 2: Run Swift tests**

Run:

```bash
cd mobile/ios/AgentsInWatchCore
swift test
```

Expected: all Swift tests pass.

- [ ] **Step 3: Validate Xcode project and schemes**

Run from the repository root:

```bash
plutil -lint mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatchWatch.xcscheme
```

Expected: `project.pbxproj: OK` and both `xmllint` commands exit with code 0.

- [ ] **Step 4: Merge and push**

If implementation was done in a worktree branch:

```bash
git checkout master
git merge --ff-only codex/codex-desktop-adapter
git worktree remove .worktrees/codex-desktop-adapter
git worktree prune
git branch -d codex/codex-desktop-adapter
git push origin master
```

If implementation was done directly on `master`, push:

```bash
git push origin master
```

Expected: `origin/master` points at the completed Codex adapter commits.

---

## Self-Review

- Spec coverage: translator, command script, smoke script, README scope note, bearer-token handling, error handling, and final verification are each covered by a task.
- Scope check: no iPhone, Watch, private Codex Desktop, or automatic UI-control implementation is included.
- Placeholder scan: no TBD/TODO/fill-in-later steps remain; every code-writing step includes exact file contents or exact README text.
- Type consistency: event names, script names, test file names, npm script name, and exported `translateCodexDesktopHook` symbol are consistent across tasks.
