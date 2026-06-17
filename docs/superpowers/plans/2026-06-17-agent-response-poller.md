# Agent Response Poller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe desktop-side script that fetches response outbox items from the helper, optionally filters them, prints newline-delimited JSON, and acknowledges them only when `--ack` is passed.

**Architecture:** Implement one standalone Node script that talks to the existing `/agent-responses` API. Keep helper, store, iPhone, and Watch code unchanged because response outbox endpoints already exist. Add script-level tests with a fake HTTP helper, then document the workflow in README.

**Tech Stack:** Node.js ESM, built-in `fetch`, `node:test`, `node:http`, existing helper API.

---

## File Structure

- Create `scripts/poll-agent-responses.js`: CLI script for parsing flags/env, fetching responses, printing NDJSON, and optional ack.
- Create `test/pollAgentResponsesScript.test.js`: end-to-end script tests against a fake helper.
- Modify `package.json`: add `poll:agent-responses` script.
- Modify `README.md`: document response polling usage and safety behavior.

---

### Task 1: Poller Script Tests

**Files:**
- Create: `test/pollAgentResponsesScript.test.js`
- Test command: `node --test test/pollAgentResponsesScript.test.js`

- [ ] **Step 1: Write the failing script tests**

Create `test/pollAgentResponsesScript.test.js`:

```js
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("poller prints matching responses as newline-delimited JSON", async () => {
  const requests = [];
  const fakeHelper = http.createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url, headers: request.headers });

    if (
      request.method === "GET" &&
      request.url === "/agent-responses?agentType=codex-desktop&sessionId=session-1"
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          responses: [
            {
              id: "response-outbox-1",
              requestId: "request-1",
              agentType: "codex-desktop",
              sessionId: "session-1",
              response: { requestId: "request-1", action: "allow", message: "" },
            },
            {
              id: "response-outbox-2",
              requestId: "request-2",
              agentType: "codex-desktop",
              sessionId: "session-1",
              response: { requestId: "request-2", action: "deny", message: "not now" },
            },
          ],
        })
      );
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({
      args: ["--agent-type", "codex-desktop", "--session-id", "session-1"],
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl },
    });

    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    const lines = result.stdout.trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(lines.length, 2);
    assert.equal(lines[0].id, "response-outbox-1");
    assert.equal(lines[1].response.action, "deny");
    assert.equal(requests.length, 1);
  } finally {
    await close(fakeHelper);
  }
});

test("poller uses environment filters and bearer token", async () => {
  const requests = [];
  const fakeHelper = http.createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url, headers: request.headers });
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ responses: [] }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({
      env: {
        AGENTS_IN_WATCH_HELPER_URL: helperUrl,
        AGENTS_IN_WATCH_TOKEN: "token-123",
        AGENTS_IN_WATCH_AGENT_TYPE: "claude-code",
        AGENTS_IN_WATCH_SESSION_ID: "session-2",
      },
    });

    assert.equal(result.code, 0);
    assert.equal(result.stdout, "");
    assert.equal(requests[0].url, "/agent-responses?agentType=claude-code&sessionId=session-2");
    assert.equal(requests[0].headers.authorization, "Bearer token-123");
  } finally {
    await close(fakeHelper);
  }
});

test("poller does not acknowledge responses without ack flag", async () => {
  const requests = [];
  const fakeHelper = http.createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url });

    if (request.method === "GET" && request.url === "/agent-responses") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ responses: [{ id: "response-outbox-1" }] }));
      return;
    }

    response.writeHead(500, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "unexpected ack" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({ env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl } });

    assert.equal(result.code, 0);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].method, "GET");
  } finally {
    await close(fakeHelper);
  }
});

test("poller acknowledges each printed response with ack flag", async () => {
  const requests = [];
  const fakeHelper = http.createServer(async (request, response) => {
    requests.push({ method: request.method, url: request.url });

    if (request.method === "GET" && request.url === "/agent-responses") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          responses: [{ id: "response-outbox-1" }, { id: "response-outbox-2" }],
        })
      );
      return;
    }

    if (
      request.method === "POST" &&
      ["/agent-responses/response-outbox-1/ack", "/agent-responses/response-outbox-2/ack"].includes(
        request.url
      )
    ) {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "not found" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({
      args: ["--ack"],
      env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl },
    });

    assert.equal(result.code, 0);
    assert.deepEqual(
      requests.map((request) => `${request.method} ${request.url}`),
      [
        "GET /agent-responses",
        "POST /agent-responses/response-outbox-1/ack",
        "POST /agent-responses/response-outbox-2/ack",
      ]
    );
  } finally {
    await close(fakeHelper);
  }
});

test("poller reports helper rejection details", async () => {
  const fakeHelper = http.createServer(async (_request, response) => {
    response.writeHead(401, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: "unauthorized" }));
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({ env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl } });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /failed to fetch agent responses/);
    assert.match(result.stderr, /401/);
    assert.match(result.stderr, /unauthorized/);
  } finally {
    await close(fakeHelper);
  }
});

test("poller reports invalid helper JSON", async () => {
  const fakeHelper = http.createServer(async (_request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("not-json");
  });
  const helperUrl = await listen(fakeHelper);

  try {
    const result = await runPoller({ env: { AGENTS_IN_WATCH_HELPER_URL: helperUrl } });

    assert.equal(result.code, 1);
    assert.match(result.stderr, /failed to parse agent responses/);
  } finally {
    await close(fakeHelper);
  }
});

function runPoller({ args = [], env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/poll-agent-responses.js", ...args], {
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

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
node --test test/pollAgentResponsesScript.test.js
```

Expected: FAIL because `scripts/poll-agent-responses.js` does not exist.

- [ ] **Step 3: Commit the failing tests**

```bash
git add test/pollAgentResponsesScript.test.js
git commit -m "test: cover agent response poller script"
```

---

### Task 2: Poller Script Implementation

**Files:**
- Create: `scripts/poll-agent-responses.js`
- Test: `test/pollAgentResponsesScript.test.js`

- [ ] **Step 1: Implement the poller script**

Create `scripts/poll-agent-responses.js`:

```js
#!/usr/bin/env node

const helperUrl = process.env.AGENTS_IN_WATCH_HELPER_URL ?? "http://127.0.0.1:42731";

try {
  const options = parseArgs(process.argv.slice(2), process.env);

  if (options.help) {
    console.log(usage());
    process.exit(0);
  }

  const responses = await fetchAgentResponses({ helperUrl, options });

  for (const response of responses) {
    console.log(JSON.stringify(response));
  }

  if (options.ack) {
    for (const response of responses) {
      await acknowledgeAgentResponse({ helperUrl, responseId: response.id, token: options.token });
    }
  }

  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function parseArgs(args, env) {
  const options = {
    ack: false,
    agentType: env.AGENTS_IN_WATCH_AGENT_TYPE,
    sessionId: env.AGENTS_IN_WATCH_SESSION_ID,
    token: env.AGENTS_IN_WATCH_TOKEN,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--ack") {
      options.ack = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--agent-type") {
      options.agentType = readFlagValue(args, index, "--agent-type");
      index += 1;
      continue;
    }

    if (arg === "--session-id") {
      options.sessionId = readFlagValue(args, index, "--session-id");
      index += 1;
      continue;
    }

    throw new Error(`unknown argument: ${arg}`);
  }

  return options;
}

function readFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

async function fetchAgentResponses({ helperUrl, options }) {
  const url = new URL("/agent-responses", helperUrl);
  if (options.agentType) {
    url.searchParams.set("agentType", options.agentType);
  }
  if (options.sessionId) {
    url.searchParams.set("sessionId", options.sessionId);
  }

  const response = await fetch(url, { headers: buildHeaders(options.token) });
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`failed to fetch agent responses: helper returned ${response.status} ${bodyText}`);
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch {
    throw new Error("failed to parse agent responses: helper returned invalid JSON");
  }

  if (!body || !Array.isArray(body.responses)) {
    throw new Error("failed to parse agent responses: helper response did not include a responses array");
  }

  return body.responses;
}

async function acknowledgeAgentResponse({ helperUrl, responseId, token }) {
  if (!responseId) {
    throw new Error("failed to acknowledge response: response id is missing");
  }

  const response = await fetch(new URL(`/agent-responses/${encodeURIComponent(responseId)}/ack`, helperUrl), {
    method: "POST",
    headers: buildHeaders(token),
  });
  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `failed to acknowledge response ${responseId}: helper returned ${response.status} ${bodyText}`
    );
  }
}

function buildHeaders(token) {
  return token ? { authorization: `Bearer ${token}` } : {};
}

function usage() {
  return `Usage: node scripts/poll-agent-responses.js [--agent-type value] [--session-id value] [--ack]

Fetch unacknowledged agent responses from the local Agents in Watch helper.

Environment:
  AGENTS_IN_WATCH_HELPER_URL   Helper URL, defaults to http://127.0.0.1:42731
  AGENTS_IN_WATCH_TOKEN        Optional bearer token
  AGENTS_IN_WATCH_AGENT_TYPE   Default agent type filter
  AGENTS_IN_WATCH_SESSION_ID   Default session id filter`;
}
```

- [ ] **Step 2: Run the focused tests**

Run:

```bash
node --test test/pollAgentResponsesScript.test.js
```

Expected: PASS.

- [ ] **Step 3: Run the full Node suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Commit the implementation**

```bash
git add scripts/poll-agent-responses.js test/pollAgentResponsesScript.test.js
git commit -m "feat: add agent response poller script"
```

---

### Task 3: Package Script and Documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Test: `npm test`

- [ ] **Step 1: Add the npm script**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "start": "node src/helper/server.js",
    "poll:agent-responses": "node scripts/poll-agent-responses.js",
    "smoke:claude-code": "node scripts/smoke-claude-code.js",
    "smoke:codex-desktop": "node scripts/smoke-codex-desktop.js",
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Document the poller in README**

Add a concise section near the response outbox documentation:

````markdown
### Poll Agent Responses

Use the poller script to fetch decisions that were made on iPhone or Apple Watch:

```bash
npm run poll:agent-responses -- --agent-type codex-desktop --session-id session-1
npm run poll:agent-responses -- --agent-type claude-code --ack
```

The script prints one JSON response per line. By default it does not acknowledge responses, so the same decisions remain available for debugging. Add `--ack` only when an adapter is ready to consume the responses.

The script uses the same helper settings as the hook scripts:

```bash
AGENTS_IN_WATCH_HELPER_URL=http://127.0.0.1:42731
AGENTS_IN_WATCH_TOKEN=your-token
AGENTS_IN_WATCH_AGENT_TYPE=codex-desktop
AGENTS_IN_WATCH_SESSION_ID=session-1
```

This command fetches decisions from the helper. It does not yet click Codex Desktop or Claude Code UI controls automatically.
````

- [ ] **Step 3: Run the full verification set**

Run:

```bash
npm test
swift test --package-path mobile/ios/AgentsInWatchCore
plutil -lint mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatchWatch.xcscheme
```

Expected: all commands PASS.

- [ ] **Step 4: Commit docs and package script**

```bash
git add package.json README.md
git commit -m "docs: document agent response poller"
```

---

## Self-Review Checklist

- Spec coverage: Tasks cover CLI creation, filtering, auth, NDJSON output, explicit ack, tests, package script, and README documentation.
- Placeholder scan: No `TBD`, `TODO`, "implement later", or "similar to" instructions remain.
- Type consistency: The plan consistently uses `responses`, `agentType`, `sessionId`, `--ack`, and `/agent-responses/:id/ack` as defined in the spec and existing helper API.
