# Agents in Watch

Agents in Watch is a local-first Apple Watch companion for AI coding agents. The MVP helps you leave your desk while Codex desktop or Claude Code is running by sending small approval and short-reply requests to your Apple Watch.

The current implementation is the first desktop-helper slice. It can:

- Accept normalized pending agent requests over a local HTTP API.
- List pending requests.
- Accept a response for a pending request.
- Pair a device and protect request APIs with bearer-token auth.
- Translate Claude Code hook payloads into the shared request model.
- Surface lightweight iPhone and Watch connectivity diagnostics while testing real devices.
- Report helper status and run a local Claude Code-style smoke test.

It does not yet include packaged desktop installers, Codex desktop adapter, Watch notifications, or background retry queues.

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

## Five-Minute Local Verification

Use this flow to prove the desktop side can receive a Claude Code-style request before opening Xcode:

1. Start the helper:

```bash
npm start
```

2. In another terminal, create and approve a pairing token using the `Pair a Device` commands below.

3. Export the token and helper URL:

```bash
export AGENTS_IN_WATCH_TOKEN=PASTE_TOKEN_HERE
export AGENTS_IN_WATCH_HELPER_URL=http://127.0.0.1:42731
export COMPUTER_NAME="$(hostname)"
```

4. Run the smoke test:

```bash
npm run smoke:claude-code
```

5. Check helper status:

```bash
curl http://127.0.0.1:42731/status
```

The smoke test creates a synthetic Claude Code `PermissionRequest`. If it succeeds, the helper has at least one pending request ready for the iPhone companion to fetch and forward to the Watch.

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

## Claude Code Hook Bridge

The script `scripts/claude-code-hook.js` reads a Claude Code hook payload from stdin, translates it, and posts it to the helper. It supports Claude Code `PermissionRequest` and `Notification` events.

```bash
export AGENTS_IN_WATCH_TOKEN=PASTE_TOKEN_HERE
export AGENTS_IN_WATCH_HELPER_URL=http://127.0.0.1:42731
export COMPUTER_NAME="$(hostname)"
```

Start Claude Code from the same shell so the hook process inherits these variables.

For a project-local Claude Code setup, create `.claude/settings.local.json` in the project where you run Claude Code:

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/agents-in-watch/scripts/claude-code-hook.js"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/absolute/path/to/agents-in-watch/scripts/claude-code-hook.js"
          }
        ]
      }
    ]
  }
}
```

Claude Code sends hook JSON to command hooks on stdin. The bridge posts the translated request to the local helper using `AGENTS_IN_WATCH_TOKEN` as a bearer token. Keep this setup in `settings.local.json` unless you intentionally want to commit hook configuration to a project.

You can smoke-test the bridge without launching Claude Code:

```bash
printf '%s\n' '{
  "hook_event_name": "PermissionRequest",
  "session_id": "manual-smoke-test",
  "cwd": "'$PWD'",
  "tool_name": "Bash",
  "tool_input": { "command": "pnpm test" },
  "permission_request": { "reason": "Manual Agents in Watch smoke test." }
}' | scripts/claude-code-hook.js
```

If the command exits with `0`, open the iPhone app and refresh pending requests. The request should appear on the phone and then on the Watch when WatchConnectivity is ready.

## iPhone App

The repository includes a minimal Xcode iPhone app target that hosts the companion SwiftUI interface.

Open:

```bash
open mobile/ios/AgentsInWatch.xcodeproj
```

Select the `AgentsInWatch` scheme, choose an iPhone simulator or device, and run. The app uses the local Swift package at `mobile/ios/AgentsInWatchCore`.

The companion screen shows whether its Watch bridge is unavailable, activating, or ready, which helps verify the iPhone can publish pending requests to the Watch before testing agent approvals.

Full app builds require Xcode. The Command Line Tools package alone is enough for `swift test`, but not enough for `xcodebuild` or simulator runs.

## Apple Watch App

The repository includes a minimal watchOS app target that hosts a compact pending-request list.

Open:

```bash
open mobile/ios/AgentsInWatch.xcodeproj
```

Select the `AgentsInWatchWatch` scheme and choose a watchOS simulator or device. The current Watch slice can display request snapshots published by the iPhone companion and send allow, deny, pause, or short reply responses back to the iPhone through the shared WatchConnectivity payload format.

The Watch screen shows whether its iPhone response bridge is unavailable, activating, or ready, so device-pairing issues are visible before you tap allow, deny, pause, or send a short reply.

## iPhone Companion Core

The repository now includes a Swift Package for the iPhone companion core:

```bash
cd mobile/ios/AgentsInWatchCore
swift test
```

The package currently contains tested models, a helper API client, a minimal SwiftUI companion interface, Keychain-backed pairing credential storage, WatchConnectivity request and response payloads, lightweight connectivity diagnostics, and a minimal Watch request-list UI. It does not yet include QR scanning, notifications, background retry queues, or simulator UI automation.

## Safety

This project is not a remote shell. The helper stores scoped agent requests and responses. It does not expose arbitrary command execution as a default capability.
