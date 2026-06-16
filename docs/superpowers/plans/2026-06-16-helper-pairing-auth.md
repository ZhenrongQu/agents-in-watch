# Helper Pairing and Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first secure pairing slice to the Desktop Helper so an iPhone client must claim a pairing code, wait for desktop approval, receive a token, and use that token for request APIs.

**Architecture:** Keep pairing state in a focused in-memory manager that can later be replaced by persistent storage. The HTTP server exposes pairing endpoints without auth, then protects agent request endpoints with bearer-token auth when `authRequired` is enabled.

**Tech Stack:** Node.js 20+, ESM JavaScript, built-in `node:test`, built-in `http`, built-in `crypto`.

---

## Scope

This plan implements:

- In-memory pairing sessions.
- Device claims that require desktop approval before a token is issued.
- Bearer token validation for request APIs.
- HTTP routes for starting pairing, claiming a code, checking claim status, and approving a claim.
- README instructions for the new authenticated flow.

This plan does not implement the iPhone UI, QR rendering, persistent device storage, TLS, Bonjour discovery, or Apple Watch UI.

## File Structure

- Create `src/helper/pairingManager.js`: pairing sessions, pending claims, approved device tokens.
- Create `test/pairingManager.test.js`: unit tests for pairing lifecycle and token auth.
- Modify `src/helper/server.js`: add pairing endpoints and request API auth.
- Modify `test/server.test.js`: cover authenticated request flow and unauthorized responses.
- Modify `README.md`: explain pairing flow and authenticated curl examples.

## Task 1: Pairing Manager

**Files:**
- Create: `src/helper/pairingManager.js`
- Create: `test/pairingManager.test.js`

- [ ] **Step 1: Write failing pairing manager tests**

Create `test/pairingManager.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createPairingManager } from "../src/helper/pairingManager.js";

test("creates a pairing session with a human-readable code", () => {
  const manager = createPairingManager({
    now: () => new Date("2026-06-16T12:00:00.000Z"),
    ttlMs: 300000,
  });

  const session = manager.createSession();

  assert.match(session.id, /^[0-9a-f-]{36}$/);
  assert.match(session.code, /^[0-9]{6}$/);
  assert.equal(session.status, "open");
  assert.equal(session.expiresAt, "2026-06-16T12:05:00.000Z");
});

test("claims a pairing code and waits for desktop approval", () => {
  const manager = createPairingManager({
    now: () => new Date("2026-06-16T12:00:00.000Z"),
  });
  const session = manager.createSession();
  const claim = manager.claimSession({
    code: session.code,
    deviceName: "Quinn's iPhone",
  });

  assert.equal(claim.status, "pending-approval");
  assert.equal(claim.deviceName, "Quinn's iPhone");
  assert.equal(claim.token, undefined);
});

test("approves a pending claim and authenticates the issued token", () => {
  const manager = createPairingManager();
  const session = manager.createSession();
  const claim = manager.claimSession({
    code: session.code,
    deviceName: "Quinn's iPhone",
  });
  const approved = manager.approveClaim(claim.id);

  assert.equal(approved.status, "approved");
  assert.match(approved.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(manager.authenticate(approved.token).deviceName, "Quinn's iPhone");
});

test("rejects expired pairing codes", () => {
  let current = new Date("2026-06-16T12:00:00.000Z");
  const manager = createPairingManager({
    now: () => current,
    ttlMs: 1000,
  });
  const session = manager.createSession();
  current = new Date("2026-06-16T12:00:02.000Z");

  assert.throws(
    () => manager.claimSession({ code: session.code, deviceName: "Late iPhone" }),
    /pairing code expired/
  );
});

test("rejects unknown bearer tokens", () => {
  const manager = createPairingManager();

  assert.throws(() => manager.authenticate("bad-token"), /invalid token/);
});
```

- [ ] **Step 2: Run pairing manager tests and confirm failure**

Run: `node --test test/pairingManager.test.js`

Expected: FAIL with a module-not-found error for `src/helper/pairingManager.js`.

- [ ] **Step 3: Implement pairing manager**

Create `src/helper/pairingManager.js`:

```js
import { randomBytes, randomInt, randomUUID } from "node:crypto";

export function createPairingManager({ now = () => new Date(), ttlMs = 300000 } = {}) {
  const sessions = new Map();
  const claims = new Map();
  const devicesByToken = new Map();

  return {
    createSession() {
      const createdAt = now();
      const session = {
        id: randomUUID(),
        code: createCode(),
        status: "open",
        createdAt: createdAt.toISOString(),
        expiresAt: new Date(createdAt.getTime() + ttlMs).toISOString(),
      };
      sessions.set(session.id, session);
      return session;
    },

    claimSession({ code, deviceName }) {
      const session = findOpenSessionByCode(sessions, normalizeCode(code));
      if (!session) {
        throw new Error("pairing code not found");
      }

      if (Date.parse(session.expiresAt) <= now().getTime()) {
        session.status = "expired";
        throw new Error("pairing code expired");
      }

      const claim = {
        id: randomUUID(),
        pairingSessionId: session.id,
        deviceName: requiredString(deviceName, "deviceName"),
        status: "pending-approval",
        createdAt: now().toISOString(),
      };
      claims.set(claim.id, claim);
      return claim;
    },

    getClaim(id) {
      const claim = claims.get(id);
      if (!claim) {
        throw new Error("claim not found");
      }
      return claim;
    },

    approveClaim(id) {
      const claim = claims.get(id);
      if (!claim) {
        throw new Error("claim not found");
      }

      if (claim.status === "approved") {
        return claim;
      }

      const approved = {
        ...claim,
        status: "approved",
        approvedAt: now().toISOString(),
        deviceId: randomUUID(),
        token: randomBytes(32).toString("base64url"),
      };
      claims.set(id, approved);
      devicesByToken.set(approved.token, {
        deviceId: approved.deviceId,
        deviceName: approved.deviceName,
        approvedAt: approved.approvedAt,
      });
      return approved;
    },

    authenticate(token) {
      const device = devicesByToken.get(requiredString(token, "token"));
      if (!device) {
        throw new Error("invalid token");
      }
      return device;
    },
  };
}

function createCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function normalizeCode(code) {
  return requiredString(code, "code").replace(/\s+/g, "");
}

function findOpenSessionByCode(sessions, code) {
  return [...sessions.values()].find(
    (session) => session.code === code && session.status === "open"
  );
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}
```

- [ ] **Step 4: Run pairing manager tests and confirm pass**

Run: `node --test test/pairingManager.test.js`

Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/helper/pairingManager.js test/pairingManager.test.js
git commit -m "feat: add helper pairing manager"
```

## Task 2: Pairing HTTP API

**Files:**
- Modify: `src/helper/server.js`
- Modify: `test/server.test.js`

- [ ] **Step 1: Add failing server tests for pairing and auth**

Append these tests to `test/server.test.js`:

```js
test("pairs a device and uses its token for request APIs", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const startResponse = await fetch(`${baseUrl}/pairing/sessions`, { method: "POST" });
    const session = await startResponse.json();
    assert.equal(startResponse.status, 201);
    assert.match(session.code, /^[0-9]{6}$/);

    const claimResponse = await fetch(`${baseUrl}/pairing/claims`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: session.code,
        deviceName: "Quinn's iPhone",
      }),
    });
    const claim = await claimResponse.json();
    assert.equal(claimResponse.status, 201);
    assert.equal(claim.status, "pending-approval");
    assert.equal(claim.token, undefined);

    const approveResponse = await fetch(`${baseUrl}/pairing/claims/${claim.id}/approve`, {
      method: "POST",
    });
    const approved = await approveResponse.json();
    assert.equal(approveResponse.status, 200);
    assert.equal(approved.status, "approved");
    assert.match(approved.token, /^[A-Za-z0-9_-]{43}$/);

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
    assert.equal(createResponse.status, 201);

    const listResponse = await fetch(`${baseUrl}/requests`, {
      headers: { authorization: `Bearer ${approved.token}` },
    });
    const pending = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(pending.requests[0].id, created.id);
  } finally {
    await close(app);
  }
});

test("rejects request APIs without a bearer token when auth is required", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/requests`);
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.error, "missing bearer token");
  } finally {
    await close(app);
  }
});
```

- [ ] **Step 2: Run server tests and confirm failure**

Run: `node --test test/server.test.js`

Expected: FAIL because `createServer` does not support pairing routes or `authRequired`.

- [ ] **Step 3: Implement pairing routes and auth guard**

Modify `src/helper/server.js` so it matches this full file:

```js
import http from "node:http";
import { createPairingManager } from "./pairingManager.js";
import { createRequestStore } from "./requestStore.js";

export function createServer({
  store = createRequestStore(),
  pairing = createPairingManager(),
  authRequired = false,
} = {}) {
  return http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/health") {
        return sendJson(response, 200, { ok: true });
      }

      if (request.method === "POST" && request.url === "/pairing/sessions") {
        return sendJson(response, 201, pairing.createSession());
      }

      if (request.method === "POST" && request.url === "/pairing/claims") {
        const body = await readJson(request);
        return sendJson(response, 201, pairing.claimSession(body));
      }

      const approveMatch = request.url.match(/^\/pairing\/claims\/([^/]+)\/approve$/);
      if (request.method === "POST" && approveMatch) {
        return sendJson(response, 200, pairing.approveClaim(approveMatch[1]));
      }

      const claimMatch = request.url.match(/^\/pairing\/claims\/([^/]+)$/);
      if (request.method === "GET" && claimMatch) {
        return sendJson(response, 200, pairing.getClaim(claimMatch[1]));
      }

      const auth = authenticateRequest(request, pairing, authRequired);
      if (!auth.ok) {
        return sendJson(response, 401, { error: auth.error });
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

function authenticateRequest(request, pairing, authRequired) {
  if (!authRequired) {
    return { ok: true };
  }

  const header = request.headers.authorization ?? "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    return { ok: false, error: "missing bearer token" };
  }

  try {
    return { ok: true, device: pairing.authenticate(match[1]) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
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
  const authRequired = process.env.AGENTS_IN_WATCH_AUTH_REQUIRED !== "0";
  const server = createServer({ authRequired });

  server.listen(port, host, () => {
    console.log(`Agents in Watch helper listening on http://${host}:${port}`);
  });
}
```

- [ ] **Step 4: Run server tests and confirm pass**

Run: `node --test test/server.test.js`

Expected: PASS, 4 tests.

- [ ] **Step 5: Run full tests**

Run: `npm test`

Expected: PASS for all tests.

- [ ] **Step 6: Commit**

```bash
git add src/helper/server.js test/server.test.js
git commit -m "feat: protect helper api with pairing auth"
```

## Task 3: README Pairing Flow

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Modify `README.md` so the `Run` and API sections explain the authenticated default:

```md
## Run

```bash
npm test
npm start
```

By default the helper listens on:

```text
http://127.0.0.1:42731
```

The helper requires pairing auth by default. For local development only, you can disable auth:

```bash
AGENTS_IN_WATCH_AUTH_REQUIRED=0 npm start
```

## Pair a Device

Start a pairing session:

```bash
curl -X POST http://127.0.0.1:42731/pairing/sessions
```

Claim the pairing code from a phone-like client:

```bash
curl -X POST http://127.0.0.1:42731/pairing/claims \
  -H 'content-type: application/json' \
  -d '{ "code": "PAIRING_CODE", "deviceName": "Quinn iPhone" }'
```

Approve the claim from the desktop:

```bash
curl -X POST http://127.0.0.1:42731/pairing/claims/CLAIM_ID/approve
```

The approval response includes a bearer token. Use it as:

```bash
TOKEN=PASTE_TOKEN_HERE
```

## Try the Local API

Create a pending request:

```bash
curl -X POST http://127.0.0.1:42731/requests \
  -H "authorization: Bearer $TOKEN" \
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
curl http://127.0.0.1:42731/requests \
  -H "authorization: Bearer $TOKEN"
```

Respond to a request:

```bash
curl -X POST http://127.0.0.1:42731/requests/REQUEST_ID/response \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{ "action": "allow" }'
```
```

- [ ] **Step 2: Run full tests**

Run: `npm test`

Expected: PASS for all tests.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: document helper pairing flow"
```

## Task 4: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run full tests**

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

- Spec coverage: this plan implements the Desktop Helper side of local confirmation and request API protection. It supports the future iPhone pairing UI without building it yet.
- Placeholder scan: all steps include concrete code, commands, and expected results.
- Type consistency: pairing claim, approved device, and bearer auth names are consistent across manager, server, tests, and README.
