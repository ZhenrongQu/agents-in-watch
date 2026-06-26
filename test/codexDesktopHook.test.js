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

test("skips auto-approved Codex approval events", () => {
  const request = translateCodexDesktopHook(
    {
      event: "approval_request",
      sessionId: "session-1",
      cwd: "/Users/me/projects/payments-api",
      toolName: "shell",
      command: "npm test",
      status: "approved",
      reason: "Matched an auto approval rule.",
    },
    { computerName: "work-mac" }
  );

  assert.equal(request, null);
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
