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
