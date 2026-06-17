# Response Outbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a helper-side response outbox so desktop adapters can poll and acknowledge Watch/iPhone decisions.

**Architecture:** Extend the existing in-memory `requestStore` to create response outbox items when requests are resolved. Expose those items through two authenticated helper HTTP routes, while keeping the existing mobile response endpoint and Swift code unchanged.

**Tech Stack:** Node.js ESM, Node built-in test runner, existing helper HTTP server, existing request model validation.

---

## File Structure

- Modify `src/helper/requestStore.js`: add response outbox storage, list filtering, and acknowledgement.
- Modify `test/requestStore.test.js`: cover outbox creation, ordering, filtering, and acknowledgement behavior.
- Modify `src/helper/server.js`: add `GET /agent-responses` and `POST /agent-responses/:id/ack`.
- Modify `test/server.test.js`: cover HTTP list/ack behavior and auth protection.
- Modify `README.md`: document the adapter-facing response flow and current non-goals.

---

### Task 1: Store-Level Response Outbox

**Files:**
- Modify: `test/requestStore.test.js`
- Modify: `src/helper/requestStore.js`

- [ ] **Step 1: Write failing store tests**

Add these tests to `test/requestStore.test.js` after `resolves a pending request`:

```js
test("adds resolved responses to an unacknowledged outbox oldest first", () => {
  const store = createRequestStore();
  const first = store.add({ ...baseRequest, sessionId: "session-1", title: "First" });
  const second = store.add({ ...baseRequest, sessionId: "session-2", title: "Second" });

  store.resolve({ requestId: first.id, action: "allow" });
  store.resolve({ requestId: second.id, action: "deny" });

  const responses = store.listAgentResponses();

  assert.equal(responses.length, 2);
  assert.deepEqual(
    responses.map((response) => response.requestId),
    [first.id, second.id]
  );
  assert.equal(responses[0].agentType, "claude-code");
  assert.equal(responses[0].projectName, "payments-api");
  assert.equal(responses[0].sessionId, "session-1");
  assert.equal(responses[0].requestType, "approval");
  assert.equal(responses[0].title, "First");
  assert.equal(responses[0].response.action, "allow");
  assert.equal(responses[0].acknowledgedAt, null);
});

test("filters response outbox by agent type and session id", () => {
  const store = createRequestStore();
  const claudeRequest = store.add({ ...baseRequest, agentType: "claude-code", sessionId: "session-1" });
  const codexRequest = store.add({ ...baseRequest, agentType: "codex-desktop", sessionId: "session-2" });

  store.resolve({ requestId: claudeRequest.id, action: "allow" });
  store.resolve({ requestId: codexRequest.id, action: "deny" });

  assert.deepEqual(
    store.listAgentResponses({ agentType: "codex-desktop" }).map((response) => response.requestId),
    [codexRequest.id]
  );
  assert.deepEqual(
    store.listAgentResponses({ agentType: "claude-code", sessionId: "session-1" }).map((response) => response.requestId),
    [claudeRequest.id]
  );
  assert.deepEqual(store.listAgentResponses({ agentType: "missing-agent" }), []);
});

test("acknowledges a response outbox item", () => {
  const store = createRequestStore();
  const request = store.add(baseRequest);
  store.resolve({ requestId: request.id, action: "allow" });
  const [outboxItem] = store.listAgentResponses();

  const acknowledged = store.ackAgentResponse(outboxItem.id);

  assert.equal(acknowledged.id, outboxItem.id);
  assert.match(acknowledged.acknowledgedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.deepEqual(store.listAgentResponses(), []);
});

test("throws when acknowledging a missing response outbox item", () => {
  const store = createRequestStore();

  assert.throws(
    () => store.ackAgentResponse("missing-response"),
    /response not found/
  );
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test test/requestStore.test.js
```

Expected: fail because `store.listAgentResponses` and `store.ackAgentResponse` do not exist.

- [ ] **Step 3: Implement store outbox**

Update `src/helper/requestStore.js` so `createRequestStore()` includes response outbox state and methods:

```js
export function createRequestStore() {
  const requests = new Map();
  const responseOutbox = new Map();
  let sequence = 0;
  let responseSequence = 0;

  return {
    add(input) {
      const request = {
        ...normalizeAgentRequest(input),
        sequence: ++sequence,
      };
      requests.set(request.id, request);
      return request;
    },

    listPending() {
      return [...requests.values()]
        .filter((request) => request.status === "pending")
        .sort((a, b) => b.sequence - a.sequence);
    },

    summary() {
      const allRequests = [...requests.values()];
      return {
        pending: allRequests.filter((request) => request.status === "pending").length,
        resolved: allRequests.filter((request) => request.status === "resolved").length,
        total: allRequests.length,
      };
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
      responseOutbox.set(`response-outbox-${++responseSequence}`, {
        id: `response-outbox-${responseSequence}`,
        requestId: request.id,
        agentType: request.agentType,
        projectName: request.projectName,
        computerName: request.computerName,
        sessionId: request.sessionId,
        requestType: request.requestType,
        title: request.title,
        response,
        createdAt: resolved.resolvedAt,
        acknowledgedAt: null,
        sequence: responseSequence,
      });
      return resolved;
    },

    listAgentResponses(filters = {}) {
      return [...responseOutbox.values()]
        .filter((item) => item.acknowledgedAt === null)
        .filter((item) => !filters.agentType || item.agentType === filters.agentType)
        .filter((item) => !filters.sessionId || item.sessionId === filters.sessionId)
        .sort((a, b) => a.sequence - b.sequence)
        .map(({ sequence, ...item }) => item);
    },

    ackAgentResponse(id) {
      const item = responseOutbox.get(id);
      if (!item) {
        throw new Error("response not found");
      }
      if (item.acknowledgedAt !== null) {
        throw new Error("response is already acknowledged");
      }
      const acknowledged = {
        ...item,
        acknowledgedAt: new Date().toISOString(),
      };
      responseOutbox.set(id, acknowledged);
      const { sequence, ...publicItem } = acknowledged;
      return publicItem;
    },
  };
}
```

- [ ] **Step 4: Run store tests**

Run:

```bash
node --test test/requestStore.test.js
```

Expected: all request store tests pass.

- [ ] **Step 5: Run full Node tests**

Run:

```bash
npm test
```

Expected: all Node tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/helper/requestStore.js test/requestStore.test.js
git commit -m "feat: add response outbox store"
```

---

### Task 2: HTTP Outbox API

**Files:**
- Modify: `test/server.test.js`
- Modify: `src/helper/server.js`

- [ ] **Step 1: Write failing server tests**

Add these tests to `test/server.test.js` before `rejects request APIs without a bearer token when auth is required`:

```js
test("lists and acknowledges agent responses over HTTP", async () => {
  const app = createServer();
  const baseUrl = await listen(app);

  try {
    const firstCreateResponse = await fetch(`${baseUrl}/requests`, {
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
    const first = await firstCreateResponse.json();
    const secondCreateResponse = await fetch(`${baseUrl}/requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        agentType: "codex-desktop",
        projectName: "site",
        computerName: "work-mac",
        sessionId: "session-2",
        requestType: "approval",
        title: "Allow shell",
        watchSummary: "Codex wants to run npm test",
        phoneContext: "Command: npm test",
        actions: ["allow", "deny"],
        riskLevel: "low",
      }),
    });
    const second = await secondCreateResponse.json();

    await fetch(`${baseUrl}/requests/${first.id}/response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "allow" }),
    });
    await fetch(`${baseUrl}/requests/${second.id}/response`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "deny" }),
    });

    const listResponse = await fetch(`${baseUrl}/agent-responses?agentType=codex-desktop&sessionId=session-2`);
    const listed = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listed.responses.length, 1);
    assert.equal(listed.responses[0].requestId, second.id);
    assert.equal(listed.responses[0].response.action, "deny");

    const ackResponse = await fetch(`${baseUrl}/agent-responses/${listed.responses[0].id}/ack`, {
      method: "POST",
    });
    const acknowledged = await ackResponse.json();

    assert.equal(ackResponse.status, 200);
    assert.equal(acknowledged.id, listed.responses[0].id);
    assert.match(acknowledged.acknowledgedAt, /^\d{4}-\d{2}-\d{2}T/);

    const afterAckResponse = await fetch(`${baseUrl}/agent-responses?agentType=codex-desktop`);
    const afterAck = await afterAckResponse.json();
    assert.deepEqual(afterAck.responses, []);
  } finally {
    await close(app);
  }
});

test("returns clear error for missing agent response acknowledgement", async () => {
  const app = createServer();
  const baseUrl = await listen(app);

  try {
    const response = await fetch(`${baseUrl}/agent-responses/missing-response/ack`, {
      method: "POST",
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error, "response not found");
  } finally {
    await close(app);
  }
});

test("protects agent response APIs when auth is required", async () => {
  const app = createServer({ authRequired: true });
  const baseUrl = await listen(app);

  try {
    const listResponse = await fetch(`${baseUrl}/agent-responses`);
    const listBody = await listResponse.json();
    const ackResponse = await fetch(`${baseUrl}/agent-responses/response-outbox-1/ack`, {
      method: "POST",
    });
    const ackBody = await ackResponse.json();

    assert.equal(listResponse.status, 401);
    assert.equal(listBody.error, "missing bearer token");
    assert.equal(ackResponse.status, 401);
    assert.equal(ackBody.error, "missing bearer token");
  } finally {
    await close(app);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test test/server.test.js
```

Expected: fail because `/agent-responses` routes do not exist.

- [ ] **Step 3: Implement HTTP routes**

Update `src/helper/server.js` after the existing `/requests/:id/response` route and before the final 404:

```js
      if (request.method === "GET" && request.url.startsWith("/agent-responses")) {
        const url = new URL(request.url, "http://localhost");
        return sendJson(response, 200, {
          responses: store.listAgentResponses({
            agentType: url.searchParams.get("agentType") ?? "",
            sessionId: url.searchParams.get("sessionId") ?? "",
          }),
        });
      }

      const agentResponseAckMatch = request.url.match(/^\/agent-responses\/([^/]+)\/ack$/);
      if (request.method === "POST" && agentResponseAckMatch) {
        return sendJson(response, 200, store.ackAgentResponse(agentResponseAckMatch[1]));
      }
```

The routes must remain after the existing auth check so protected helpers reject unauthenticated outbox access.

- [ ] **Step 4: Run server tests**

Run:

```bash
node --test test/server.test.js
```

Expected: all server tests pass.

- [ ] **Step 5: Run full Node tests**

Run:

```bash
npm test
```

Expected: all Node tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/helper/server.js test/server.test.js
git commit -m "feat: expose response outbox API"
```

---

### Task 3: README Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update feature list**

In `README.md`, add a feature bullet near the request response bullet:

```md
- Expose resolved request responses through an adapter-facing outbox.
```

- [ ] **Step 2: Add response outbox docs**

Add this section after `Try the Local API` and before `Claude Code Hook Bridge`:

````md
## Response Outbox

When the iPhone or Watch responds to a pending request, the helper resolves that request and creates an adapter-facing outbox item. Desktop adapters can poll this queue, handle the response, and acknowledge it after processing.

List unacknowledged responses:

```bash
curl "http://127.0.0.1:42731/agent-responses?agentType=codex-desktop" \
  -H "authorization: Bearer $TOKEN"
```

Acknowledge a response after the desktop adapter handles it:

```bash
curl -X POST http://127.0.0.1:42731/agent-responses/RESPONSE_OUTBOX_ID/ack \
  -H "authorization: Bearer $TOKEN"
```

This outbox does not automatically click Codex Desktop or Claude Code UI. It gives adapter code a safe, structured place to pick up remote decisions.
````

- [ ] **Step 3: Run Node tests**

Run:

```bash
npm test
```

Expected: all Node tests pass.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document response outbox"
```

---

### Task 4: Final Verification and Integration

**Files:**
- No new files.

- [ ] **Step 1: Run full Node tests**

Run from repository root:

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

Run from repository root:

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
git merge --ff-only codex/response-outbox
git worktree remove .worktrees/response-outbox
git worktree prune
git branch -d codex/response-outbox
git push origin master
```

If implementation was done directly on `master`, push:

```bash
git push origin master
```

Expected: `origin/master` points at the completed Response Outbox commits.

---

## Self-Review

- Spec coverage: outbox creation on resolve, list API, ack API, agent/session filters, auth protection, docs, and final verification are each covered.
- Scope check: no mobile UI, persistent database, streaming, push, or automatic Codex/Claude UI control is included.
- Placeholder scan: no TBD/TODO/fill-in-later steps remain; every code-writing step includes exact code or README text.
- Type consistency: method names `listAgentResponses` and `ackAgentResponse`, route names `/agent-responses` and `/agent-responses/:id/ack`, and response field names match across tasks.
