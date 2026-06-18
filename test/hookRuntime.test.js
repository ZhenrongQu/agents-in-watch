import assert from "node:assert/strict";
import test from "node:test";
import {
  formatAgentHookResponse,
  formatHookResponseForOutput,
  readRuntimeOptions,
} from "../src/adapters/hookRuntime.js";

test("formats allow responses as approved agent results", () => {
  assert.deepEqual(
    formatAgentHookResponse({
      id: "response-outbox-1",
      requestId: "request-1",
      response: { requestId: "request-1", action: "allow", message: "" },
    }),
    {
      action: "allow",
      message: "",
      requestId: "request-1",
      responseId: "response-outbox-1",
      shouldContinue: true,
      status: "approved",
    }
  );
});

test("formats deny responses as denied agent results", () => {
  assert.deepEqual(
    formatAgentHookResponse({
      id: "response-outbox-2",
      response: { requestId: "request-2", action: "deny", message: "not now" },
    }),
    {
      action: "deny",
      message: "not now",
      requestId: "request-2",
      responseId: "response-outbox-2",
      shouldContinue: false,
      status: "denied",
    }
  );
});

test("formats reply responses as replied agent results", () => {
  assert.deepEqual(
    formatAgentHookResponse({
      id: "response-outbox-3",
      response: { requestId: "request-3", action: "reply", message: "继续" },
    }),
    {
      action: "reply",
      message: "继续",
      requestId: "request-3",
      responseId: "response-outbox-3",
      shouldContinue: true,
      status: "replied",
    }
  );
});

test("formats pause responses as paused agent results", () => {
  assert.deepEqual(
    formatAgentHookResponse({
      id: "response-outbox-4",
      response: { requestId: "request-4", action: "pause", message: "" },
    }),
    {
      action: "pause",
      message: "",
      requestId: "request-4",
      responseId: "response-outbox-4",
      shouldContinue: false,
      status: "paused",
    }
  );
});

test("formats Claude Code PermissionRequest allow decisions", () => {
  assert.deepEqual(
    formatHookResponseForOutput(
      {
        response: { requestId: "request-1", action: "allow", message: "" },
      },
      {
        hookEventName: "PermissionRequest",
        outputFormat: "claude-code",
      }
    ),
    {
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: {
          behavior: "allow",
        },
      },
    }
  );
});

test("formats Claude Code PermissionRequest deny decisions with messages", () => {
  assert.deepEqual(
    formatHookResponseForOutput(
      {
        response: { requestId: "request-2", action: "deny", message: "not now" },
      },
      {
        hookEventName: "PermissionRequest",
        outputFormat: "claude-code",
      }
    ),
    {
      hookSpecificOutput: {
        hookEventName: "PermissionRequest",
        decision: {
          behavior: "deny",
          message: "not now",
        },
      },
    }
  );
});

test("keeps generic agent JSON output by default", () => {
  assert.deepEqual(
    formatHookResponseForOutput({
      id: "response-outbox-3",
      response: { requestId: "request-3", action: "pause", message: "" },
    }),
    {
      action: "pause",
      message: "",
      requestId: "request-3",
      responseId: "response-outbox-3",
      shouldContinue: false,
      status: "paused",
    }
  );
});

test("reads output format from runtime environment", () => {
  assert.equal(
    readRuntimeOptions({
      AGENTS_IN_WATCH_OUTPUT_FORMAT: "claude-code",
    }).outputFormat,
    "claude-code"
  );
});
