# Desktop Helper Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first runnable vertical slice: a local Desktop Helper that accepts a Claude Code-style request, stores it as a pending agent request, exposes it over a local HTTP API, accepts a reply, and marks the request resolved.

**Architecture:** Use a small Node.js service with no external runtime dependencies. Keep shared request validation, in-memory storage, HTTP routing, and Claude Code hook translation in separate files so the later iPhone/Watch clients can consume the same request model without caring which agent produced it.

**Tech Stack:** Node.js 20+, ESM JavaScript, built-in `node:test`, built-in `http`, built-in `crypto`.

---

## Scope

This plan implements only the first technical slice of the MVP:

- Shared pending-request model.
- In-memory request store.
- Local HTTP API for listing pending requests and sending responses.
- Claude Code hook payload translator.
- A hook CLI script that can post Claude Code hook JSON to the Desktop Helper.
- README instructions for running and testing this slice.

This plan does not implement the iPhone app, Apple Watch app, Windows/macOS packaging, or Codex desktop adapter. Those are separate plans after this slice is verified.

## File Structure

- Create `package.json`: project scripts and Node engine.
- Create `src/shared/requestModel.js`: validate and normalize common request objects and responses.
- Create `test/requestModel.test.js`: unit tests for request validation and response validation.
- Create `src/helper/requestStore.js`: in-memory pending/resolved request store.
- Create `test/requestStore.test.js`: unit tests for store behavior.
- Create `src/helper/server.js`: local HTTP server and route handlers.
- Create `test/server.test.js`: integration tests for the HTTP API.
- Create `src/adapters/claudeCodeHook.js`: translate Claude Code hook JSON into the common request model.
- Create `test/claudeCodeHook.test.js`: unit tests for Claude Code hook translation.
- Create `scripts/claude-code-hook.js`: CLI hook bridge that reads JSON from stdin and posts it to the helper.
- Modify `README.md`: explain what the first slice does and how to run it.

## Task 1: Project Scripts

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create package metadata**

Create `package.json`:

```json
{
  "name": "agents-in-watch",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Local-first Apple Watch companion for AI agent approvals.",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "start": "node src/helper/server.js",
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Verify test command runs**

Run: `npm test`

Expected: Node exits successfully and reports that no tests were found, or reports zero test files.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add node project scripts"
```

## Task 2: Common Request Model

**Files:**
- Create: `src/shared/requestModel.js`
- Create: `test/requestModel.test.js`

- [ ] **Step 1: Write failing model tests**

Create `test/requestModel.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeAgentRequest,
  normalizeAgentResponse,
} from "../src/shared/requestModel.js";

test("normalizes a valid approval request", () => {
  const request = normalizeAgentRequest({
    agentType: "claude-code",
    projectName: "payments-api",
    computerName: "work-mac",
    sessionId: "session-1",
    requestType: "approval",
    title: "Allow command",
    watchSummary: "Claude wants to run pnpm test",
    phoneContext: "Command: pnpm test\nReason: verify changes",
    actions: ["allow", "deny", "pause"],
    riskLevel: "low",
  });

  assert.equal(request.agentType, "claude-code");
  assert.equal(request.status, "pending");
  assert.equal(request.requestType, "approval");
  assert.match(request.id, /^[0-9a-f-]{36}$/);
  assert.ok(request.createdAt.endsWith("Z"));
});

test("rejects vague watch prompts", () => {
  assert.throws(
    () =>
      normalizeAgentRequest({
        agentType: "claude-code",
        projectName: "payments-api",
        computerName: "work-mac",
        sessionId: "session-1",
        requestType: "approval",
        title: "Allow?",
        watchSummary: "yes/no",
        phoneContext: "No useful context",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    /watchSummary must explain the requested action/
  );
});

test("normalizes a short text response", () => {
  const response = normalizeAgentResponse({
    requestId: "request-1",
    action: "reply",
    message: "Continue, but do not change database migrations.",
  });

  assert.deepEqual(response, {
    requestId: "request-1",
    action: "reply",
    message: "Continue, but do not change database migrations.",
  });
});

test("requires a message for reply responses", () => {
  assert.throws(
    () => normalizeAgentResponse({ requestId: "request-1", action: "reply" }),
    /message is required for reply/
  );
});
```

- [ ] **Step 2: Run model tests and confirm failure**

Run: `node --test test/requestModel.test.js`

Expected: FAIL with a module-not-found error for `src/shared/requestModel.js`.

- [ ] **Step 3: Implement request model**

Create `src/shared/requestModel.js`:

```js
import { randomUUID } from "node:crypto";

const AGENT_TYPES = new Set(["claude-code", "codex-desktop"]);
const REQUEST_TYPES = new Set(["approval", "short-reply", "pause", "notification"]);
const ACTIONS = new Set(["allow", "deny", "pause", "reply", "open-phone"]);
const RISK_LEVELS = new Set(["low", "medium", "high"]);

export function normalizeAgentRequest(input) {
  const request = {
    id: input.id ?? randomUUID(),
    agentType: requiredString(input.agentType, "agentType"),
    projectName: requiredString(input.projectName, "projectName"),
    computerName: requiredString(input.computerName, "computerName"),
    sessionId: requiredString(input.sessionId, "sessionId"),
    requestType: requiredString(input.requestType, "requestType"),
    title: requiredString(input.title, "title"),
    watchSummary: requiredString(input.watchSummary, "watchSummary"),
    phoneContext: requiredString(input.phoneContext, "phoneContext"),
    actions: normalizeActions(input.actions),
    riskLevel: input.riskLevel ?? "low",
    status: input.status ?? "pending",
    createdAt: input.createdAt ?? new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
  };

  if (!AGENT_TYPES.has(request.agentType)) {
    throw new Error(`unsupported agentType: ${request.agentType}`);
  }

  if (!REQUEST_TYPES.has(request.requestType)) {
    throw new Error(`unsupported requestType: ${request.requestType}`);
  }

  if (!RISK_LEVELS.has(request.riskLevel)) {
    throw new Error(`unsupported riskLevel: ${request.riskLevel}`);
  }

  if (request.status !== "pending" && request.status !== "resolved") {
    throw new Error(`unsupported status: ${request.status}`);
  }

  if (isVagueWatchSummary(request.watchSummary)) {
    throw new Error("watchSummary must explain the requested action");
  }

  return request;
}

export function normalizeAgentResponse(input) {
  const requestId = requiredString(input.requestId, "requestId");
  const action = requiredString(input.action, "action");

  if (!ACTIONS.has(action)) {
    throw new Error(`unsupported action: ${action}`);
  }

  if (action === "reply") {
    return {
      requestId,
      action,
      message: requiredString(input.message, "message is required for reply"),
    };
  }

  return {
    requestId,
    action,
    message: input.message ? String(input.message) : "",
  };
}

function normalizeActions(actions) {
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new Error("actions must contain at least one action");
  }

  for (const action of actions) {
    if (!ACTIONS.has(action)) {
      throw new Error(`unsupported action: ${action}`);
    }
  }

  return [...new Set(actions)];
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}

function isVagueWatchSummary(summary) {
  const normalized = summary.trim().toLowerCase();
  return normalized === "yes/no" || normalized === "allow?" || normalized === "approve?";
}
```

- [ ] **Step 4: Run model tests and confirm pass**

Run: `node --test test/requestModel.test.js`

Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/shared/requestModel.js test/requestModel.test.js
git commit -m "feat: add common request model"
```

## Task 3: Request Store

**Files:**
- Create: `src/helper/requestStore.js`
- Create: `test/requestStore.test.js`

- [ ] **Step 1: Write failing store tests**

Create `test/requestStore.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createRequestStore } from "../src/helper/requestStore.js";

const baseRequest = {
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
};

test("adds and lists pending requests newest first", () => {
  const store = createRequestStore();
  const first = store.add({ ...baseRequest, title: "First" });
  const second = store.add({ ...baseRequest, title: "Second" });

  assert.deepEqual(
    store.listPending().map((request) => request.id),
    [second.id, first.id]
  );
});

test("resolves a pending request", () => {
  const store = createRequestStore();
  const request = store.add(baseRequest);
  const resolved = store.resolve({
    requestId: request.id,
    action: "allow",
  });

  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.response.action, "allow");
  assert.deepEqual(store.listPending(), []);
});

test("throws when resolving an unknown request", () => {
  const store = createRequestStore();

  assert.throws(
    () => store.resolve({ requestId: "missing", action: "allow" }),
    /request not found/
  );
});
```

- [ ] **Step 2: Run store tests and confirm failure**

Run: `node --test test/requestStore.test.js`

Expected: FAIL with a module-not-found error for `src/helper/requestStore.js`.

- [ ] **Step 3: Implement request store**

Create `src/helper/requestStore.js`:

```js
import {
  normalizeAgentRequest,
  normalizeAgentResponse,
} from "../shared/requestModel.js";

export function createRequestStore() {
  const requests = new Map();

  return {
    add(input) {
      const request = normalizeAgentRequest(input);
      requests.set(request.id, request);
      return request;
    },

    listPending() {
      return [...requests.values()]
        .filter((request) => request.status === "pending")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    resolve(input) {
      const response = normalizeAgentResponse(input);
      const request = requests.get(response.requestId);

      if (!request) {
        throw new Error("request not found");
      }

      if (request.status !== "pending") {
        throw new Error("request is already resolved");
      }

      const resolved = {
        ...request,
        status: "resolved",
        resolvedAt: new Date().toISOString(),
        response,
      };
      requests.set(request.id, resolved);
      return resolved;
    },
  };
}
```

- [ ] **Step 4: Run store tests and confirm pass**

Run: `node --test test/requestStore.test.js`

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/helper/requestStore.js test/requestStore.test.js
git commit -m "feat: add pending request store"
```

## Task 4: Local HTTP API

**Files:**
- Create: `src/helper/server.js`
- Create: `test/server.test.js`

- [ ] **Step 1: Write failing API tests**

Create `test/server.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../src/helper/server.js";

test("creates, lists, and resolves requests over HTTP", async () => {
  const app = createServer();
  const baseUrl = await listen(app);

  try {
    const createResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
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

    assert.equal(createResponse.status, 201);
    assert.equal(created.status, "pending");

    const listResponse = await fetch(`${baseUrl}/requests`);
    const pending = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(pending.requests.length, 1);
    assert.equal(pending.requests[0].id, created.id);

    const resolveResponse = await fetch(`${baseUrl}/requests/${created.id}/response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "allow" }),
    });
    const resolved = await resolveResponse.json();

    assert.equal(resolveResponse.status, 200);
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.response.action, "allow");
  } finally {
    await close(app);
  }
});

test("returns 400 for invalid request payloads", async () => {
  const app = createServer();
  const baseUrl = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.match(body.error, /agentType is required/);
  } finally {
    await close(app);
  }
});

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

- [ ] **Step 2: Run API tests and confirm failure**

Run: `node --test test/server.test.js`

Expected: FAIL with a module-not-found error for `src/helper/server.js`.

- [ ] **Step 3: Implement local HTTP API**

Create `src/helper/server.js`:

```js
import http from "node:http";
import { createRequestStore } from "./requestStore.js";

export function createServer({ store = createRequestStore() } = {}) {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        return sendJson(response, 200, { ok: true });
      }

      if (request.method === "GET" && request.url === "/requests") {
        return sendJson(response, 200, { requests: store.listPending() });
      }

      if (request.method === "POST" && request.url === "/requests") {
        const body = await readJson(request);
        const created = store.add(body);
        return sendJson(response, 201, created);
      }

      const responseMatch = request.url.match(/^\/requests\/([^/]+)\/response$/);
      if (request.method === "POST" && responseMatch) {
        const body = await readJson(request);
        const resolved = store.resolve({
          requestId: responseMatch[1],
          ...body,
        });
        return sendJson(response, 200, resolved);
      }

      return sendJson(response, 404, { error: "not found" });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  });
}

async function readJson(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.AGENTS_IN_WATCH_PORT ?? 42731);
  const host = process.env.AGENTS_IN_WATCH_HOST ?? "127.0.0.1";
  const server = createServer();

  server.listen(port, host, () => {
    console.log(`Agents in Watch helper listening on http://${host}:${port}`);
  });
}
```

- [ ] **Step 4: Run API tests and confirm pass**

Run: `node --test test/server.test.js`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/helper/server.js test/server.test.js
git commit -m "feat: add local helper api"
```

## Task 5: Claude Code Hook Translator

**Files:**
- Create: `src/adapters/claudeCodeHook.js`
- Create: `test/claudeCodeHook.test.js`

- [ ] **Step 1: Write failing translator tests**

Create `test/claudeCodeHook.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { translateClaudeCodeHook } from "../src/adapters/claudeCodeHook.js";

test("translates a PermissionRequest hook into an approval request", () => {
  const request = translateClaudeCodeHook(
    {
      hook_event_name: "PermissionRequest",
      session_id: "session-1",
      cwd: "/Users/me/projects/payments-api",
      tool_name: "Bash",
      tool_input: {
        command: "pnpm test",
      },
      permission_request: {
        reason: "Claude wants to verify the changes.",
      },
    },
    { computerName: "work-mac" }
  );

  assert.equal(request.agentType, "claude-code");
  assert.equal(request.projectName, "payments-api");
  assert.equal(request.sessionId, "session-1");
  assert.equal(request.requestType, "approval");
  assert.equal(request.title, "Allow Bash");
  assert.equal(request.watchSummary, "Claude wants to run: pnpm test");
  assert.match(request.phoneContext, /Claude wants to verify the changes/);
  assert.deepEqual(request.actions, ["allow", "deny", "pause"]);
});

test("translates a Notification hook into a notification request", () => {
  const request = translateClaudeCodeHook(
    {
      hook_event_name: "Notification",
      session_id: "session-2",
      cwd: "/Users/me/projects/site",
      notification_type: "idle_prompt",
      message: "Claude is waiting for input.",
    },
    { computerName: "work-mac" }
  );

  assert.equal(request.requestType, "notification");
  assert.equal(request.title, "Claude Code notification");
  assert.equal(request.watchSummary, "Claude is waiting for input.");
  assert.deepEqual(request.actions, ["open-phone", "pause"]);
});
```

- [ ] **Step 2: Run translator tests and confirm failure**

Run: `node --test test/claudeCodeHook.test.js`

Expected: FAIL with a module-not-found error for `src/adapters/claudeCodeHook.js`.

- [ ] **Step 3: Implement translator**

Create `src/adapters/claudeCodeHook.js`:

```js
import path from "node:path";
import { normalizeAgentRequest } from "../shared/requestModel.js";

export function translateClaudeCodeHook(payload, options = {}) {
  const eventName = payload.hook_event_name ?? payload.hookEventName;
  const computerName = options.computerName ?? "local-computer";
  const projectName = projectNameFromCwd(payload.cwd);
  const sessionId = payload.session_id ?? payload.sessionId ?? "unknown-session";

  if (eventName === "PermissionRequest") {
    const toolName = payload.tool_name ?? "tool";
    const command = payload.tool_input?.command;
    const actionText = command ? `run: ${command}` : `use ${toolName}`;
    const reason = payload.permission_request?.reason ?? "Claude Code is requesting permission.";

    return normalizeAgentRequest({
      agentType: "claude-code",
      projectName,
      computerName,
      sessionId,
      requestType: "approval",
      title: `Allow ${toolName}`,
      watchSummary: `Claude wants to ${actionText}`,
      phoneContext: [
        `Event: ${eventName}`,
        `Tool: ${toolName}`,
        command ? `Command: ${command}` : "",
        `Reason: ${reason}`,
      ]
        .filter(Boolean)
        .join("\n"),
      actions: ["allow", "deny", "pause"],
      riskLevel: riskLevelForPermission(payload),
    });
  }

  if (eventName === "Notification") {
    const message = payload.message ?? "Claude Code needs attention.";

    return normalizeAgentRequest({
      agentType: "claude-code",
      projectName,
      computerName,
      sessionId,
      requestType: "notification",
      title: "Claude Code notification",
      watchSummary: message,
      phoneContext: `Notification type: ${payload.notification_type ?? "unknown"}\n${message}`,
      actions: ["open-phone", "pause"],
      riskLevel: "low",
    });
  }

  throw new Error(`unsupported Claude Code hook event: ${eventName}`);
}

function projectNameFromCwd(cwd) {
  if (typeof cwd !== "string" || cwd.trim() === "") {
    return "unknown-project";
  }

  return path.basename(cwd);
}

function riskLevelForPermission(payload) {
  const command = payload.tool_input?.command;

  if (typeof command !== "string") {
    return "medium";
  }

  if (/\brm\b|\bsudo\b|\bchmod\b|\bcurl\b.*\|\s*(sh|bash)/.test(command)) {
    return "high";
  }

  return "low";
}
```

- [ ] **Step 4: Run translator tests and confirm pass**

Run: `node --test test/claudeCodeHook.test.js`

Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/claudeCodeHook.js test/claudeCodeHook.test.js
git commit -m "feat: translate claude code hooks"
```

## Task 6: Claude Code Hook Bridge Script

**Files:**
- Create: `scripts/claude-code-hook.js`
- Create: `test/claudeCodeHookScript.test.js`

- [ ] **Step 1: Write failing script test**

Create `test/claudeCodeHookScript.test.js`:

```js
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import test from "node:test";

test("hook script posts translated requests to helper", async () => {
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
        hook_event_name: "PermissionRequest",
        session_id: "session-1",
        cwd: "/Users/me/projects/payments-api",
        tool_name: "Bash",
        tool_input: { command: "pnpm test" },
      }),
    });

    assert.equal(result.code, 0);
    assert.equal(receivedBodies.length, 1);
    assert.equal(receivedBodies[0].agentType, "claude-code");
    assert.equal(receivedBodies[0].watchSummary, "Claude wants to run: pnpm test");
  } finally {
    await close(fakeHelper);
  }
});

function runHookScript({ env, input }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["scripts/claude-code-hook.js"], {
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

- [ ] **Step 2: Run script test and confirm failure**

Run: `node --test test/claudeCodeHookScript.test.js`

Expected: FAIL because `scripts/claude-code-hook.js` does not exist.

- [ ] **Step 3: Implement hook bridge script**

Create `scripts/claude-code-hook.js`:

```js
#!/usr/bin/env node
import { translateClaudeCodeHook } from "../src/adapters/claudeCodeHook.js";

const helperUrl = process.env.AGENTS_IN_WATCH_HELPER_URL ?? "http://127.0.0.1:42731";
const computerName = process.env.COMPUTER_NAME ?? "local-computer";

try {
  const payload = JSON.parse(await readStdin());
  const request = translateClaudeCodeHook(payload, { computerName });
  const response = await fetch(`${helperUrl}/requests`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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

- [ ] **Step 4: Make script executable**

Run: `chmod +x scripts/claude-code-hook.js`

Expected: command exits successfully.

- [ ] **Step 5: Run script test and confirm pass**

Run: `node --test test/claudeCodeHookScript.test.js`

Expected: PASS, 1 test.

- [ ] **Step 6: Commit**

```bash
git add scripts/claude-code-hook.js test/claudeCodeHookScript.test.js
git commit -m "feat: add claude code hook bridge"
```

## Task 7: README for the First Slice

**Files:**
- Create: `README.md`

- [ ] **Step 1: Add README**

Create `README.md`:

```md
# Agents in Watch

Agents in Watch is a local-first Apple Watch companion for AI coding agents. The MVP helps you leave your desk while Codex desktop or Claude Code is running by sending small approval and short-reply requests to your Apple Watch.

The current implementation is the first desktop-helper slice. It can:

- Accept normalized pending agent requests over a local HTTP API.
- List pending requests.
- Accept a response for a pending request.
- Translate Claude Code hook payloads into the shared request model.

It does not yet include the iPhone app, Apple Watch app, packaged desktop installer, or Codex desktop adapter.

## Run

```bash
npm test
npm start
```

By default the helper listens on:

```text
http://127.0.0.1:42731
```

## Try the Local API

Create a pending request:

```bash
curl -X POST http://127.0.0.1:42731/requests \
  -H 'content-type: application/json' \
  -d '{
    "agentType": "claude-code",
    "projectName": "payments-api",
    "computerName": "work-mac",
    "sessionId": "session-1",
    "requestType": "approval",
    "title": "Allow command",
    "watchSummary": "Claude wants to run pnpm test",
    "phoneContext": "Command: pnpm test",
    "actions": ["allow", "deny", "pause"],
    "riskLevel": "low"
  }'
```

List pending requests:

```bash
curl http://127.0.0.1:42731/requests
```

Respond to a request:

```bash
curl -X POST http://127.0.0.1:42731/requests/REQUEST_ID/response \
  -H 'content-type: application/json' \
  -d '{ "action": "allow" }'
```

## Claude Code Hook Bridge

The script `scripts/claude-code-hook.js` reads a Claude Code hook payload from stdin, translates it, and posts it to the helper:

```bash
AGENTS_IN_WATCH_HELPER_URL=http://127.0.0.1:42731 \
COMPUTER_NAME=work-mac \
scripts/claude-code-hook.js
```

Claude Code hook configuration will be documented after the hook behavior is verified against a live Claude Code session.

## Safety

This project is not a remote shell. The helper stores scoped agent requests and responses. It does not expose arbitrary command execution as a default capability.
```

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: PASS for all tests.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document desktop helper slice"
```

## Task 8: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: PASS for all tests.

- [ ] **Step 2: Start the helper manually**

Run: `npm start`

Expected: prints `Agents in Watch helper listening on http://127.0.0.1:42731`.

- [ ] **Step 3: Stop the helper**

Press `Ctrl+C`.

Expected: process exits cleanly.

- [ ] **Step 4: Check git status**

Run: `git status --short`

Expected: no output.

## Self-Review Notes

- Spec coverage: this plan covers the Desktop Helper, common request model, Claude Code adapter, local API, safety default of no arbitrary shell, and README documentation. It intentionally does not cover iPhone, Watch, packaging, cloud relay, or Codex desktop adapter implementation.
- Placeholder scan: no steps rely on TBD/TODO language; every code step includes concrete content.
- Type consistency: request fields match the design spec names and are reused consistently across model, store, server, adapter, and script tests.
