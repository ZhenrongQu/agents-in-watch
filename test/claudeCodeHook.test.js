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

test("skips auto-approved PermissionRequest hooks", () => {
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
        status: "approved",
        reason: "Matched an auto approval rule.",
      },
    },
    { computerName: "work-mac" }
  );

  assert.equal(request, null);
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
