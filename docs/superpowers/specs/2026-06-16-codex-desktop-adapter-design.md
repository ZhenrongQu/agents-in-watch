# Codex Desktop Adapter Design

## Product Goal

Agents in Watch should support Codex Desktop alongside Claude Code. The first Codex slice should let a Codex-originated approval or attention request enter the existing helper, iPhone, and Watch flow without depending on fragile desktop UI automation.

This gives the project a safe, testable integration point now, while leaving room to connect a future official Codex event source when one is stable.

## Scope

This MVP adds a Codex Desktop event adapter that reads JSON from stdin, translates it into the shared pending-request model, and posts it to the local Desktop Helper.

In scope:

- Translate Codex approval-style events into `agentType: "codex-desktop"` requests.
- Translate Codex notification/attention events into `notification` requests.
- Add a command script similar to the existing Claude Code hook script.
- Include bearer-token support through `AGENTS_IN_WATCH_TOKEN`.
- Add a smoke command that proves a Codex-style request reaches the helper.
- Document the JSON contract and local verification flow.

Out of scope:

- Clicking Codex Desktop UI buttons automatically.
- Reverse engineering private Codex Desktop internals.
- Guaranteeing bidirectional control back into a live Codex Desktop session.
- Changing the iPhone or Watch request UI.

## User Experience

For users, this stage makes Codex Desktop visible in the same request list as Claude Code. A request created by the Codex adapter appears on iPhone and Watch as a normal pending request. The watch summary should be short and action-oriented, such as "Codex wants to run: npm test".

The user can continue to allow, deny, pause, or open the phone from the existing iPhone/Watch surfaces. In this MVP, those responses are stored by the helper like other request responses; applying the response back into Codex Desktop requires a later integration with a stable Codex control surface.

## Event Contract

The adapter accepts a small JSON contract rather than a private Codex Desktop object shape.

Approval event example:

```json
{
  "event": "approval_request",
  "sessionId": "session-1",
  "cwd": "/Users/me/projects/payments-api",
  "toolName": "shell",
  "command": "npm test",
  "reason": "Codex wants to verify the changes."
}
```

Notification event example:

```json
{
  "event": "notification",
  "sessionId": "session-2",
  "cwd": "/Users/me/projects/site",
  "message": "Codex is waiting for input."
}
```

Supported event aliases should be conservative:

- `approval_request` and `approval-request` map to approval requests.
- `notification` maps to notification requests.

Unknown events fail clearly instead of creating vague requests.

## Architecture

The implementation follows the existing Claude Code integration shape.

- `src/adapters/codexDesktopHook.js` exports `translateCodexDesktopHook(payload, options)`.
- `scripts/codex-desktop-hook.js` reads stdin JSON, translates it, and posts to `${AGENTS_IN_WATCH_HELPER_URL}/requests`.
- `scripts/smoke-codex-desktop.js` creates a synthetic Codex approval event and checks `/status` before and after.
- The helper API, request store, iPhone companion, Watch app, and notification flow stay unchanged because they already consume the shared request model.

Risk detection should stay simple:

- Commands containing `rm`, `sudo`, `chmod`, or `curl ... | sh/bash` are high risk.
- Other command approvals are low risk.
- Non-command approvals default to medium risk.
- Notifications are low risk.

## Error Handling

The adapter should reject unsupported event names with a message that names the unsupported event. It should also rely on `normalizeAgentRequest` for required-field and vague-summary validation.

The script should mirror the Claude Code script:

- Invalid stdin JSON exits non-zero and prints the parse error.
- Helper rejection exits non-zero and includes the helper status/body.
- Missing `AGENTS_IN_WATCH_TOKEN` is allowed, but protected helpers will reject the request with a clear error.

## Testing

Node tests should cover:

- Translating a Codex approval event into a normalized `codex-desktop` approval request.
- Translating a Codex notification event.
- Rejecting unsupported Codex events.
- The hook script posts translated requests to a fake helper.
- The hook script includes the bearer token when configured.
- The hook script reports helper rejection details.
- The smoke script increments helper request counts.

No iPhone or Watch changes are required for this slice, so Swift tests should remain unchanged but still pass in final verification.

## Release Notes

README should document:

- The Codex adapter is a local JSON bridge for safe MVP testing.
- It does not yet click Codex Desktop UI or automatically apply responses back into a live Codex session.
- How to run the Codex smoke test with `AGENTS_IN_WATCH_TOKEN` and `AGENTS_IN_WATCH_HELPER_URL`.
