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
