# Agents in Watch

Agents in Watch is a local-first Apple Watch companion for AI coding agents. The MVP helps you leave your desk while Codex desktop or Claude Code is running by sending small approval and short-reply requests to your Apple Watch.

The current implementation is the first desktop-helper slice. It can:

- Accept normalized pending agent requests over a local HTTP API.
- List pending requests.
- Accept a response for a pending request.
- Pair a device and protect request APIs with bearer-token auth.
- Translate Claude Code hook payloads into the shared request model.

It does not yet include a standalone Xcode app target, Apple Watch app, packaged desktop installer, or Codex desktop adapter.

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

## Claude Code Hook Bridge

The script `scripts/claude-code-hook.js` reads a Claude Code hook payload from stdin, translates it, and posts it to the helper:

```bash
AGENTS_IN_WATCH_HELPER_URL=http://127.0.0.1:42731 \
COMPUTER_NAME=work-mac \
scripts/claude-code-hook.js
```

Claude Code hook configuration will be documented after the hook behavior is verified against a live Claude Code session.

## iPhone Companion Core

The repository now includes a Swift Package for the iPhone companion core:

```bash
cd mobile/ios/AgentsInWatchCore
swift test
```

The package currently contains tested models, a helper API client, and a minimal SwiftUI companion interface. It does not yet include a standalone Xcode app target, QR scanning, Keychain token storage, or WatchConnectivity.

## Safety

This project is not a remote shell. The helper stores scoped agent requests and responses. It does not expose arbitrary command execution as a default capability.
