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

test("throws when resolving an unknown request", () => {
  const store = createRequestStore();

  assert.throws(
    () => store.resolve({ requestId: "missing", action: "allow" }),
    /request not found/
  );
});
