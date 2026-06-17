# Response Outbox Design

## Product Goal

Agents in Watch should make a Watch or iPhone decision available to the desktop-side agent adapter after the user taps allow, deny, pause, or sends a short reply. Today the helper records the request as resolved, but there is no standard adapter-facing way to pick up that response and continue the desktop workflow.

This MVP adds a response outbox: a small helper-side queue of resolved request responses that desktop adapters can poll and acknowledge.

## Scope

In scope:

- Create an outbox item when `POST /requests/:id/response` resolves a pending request.
- Let desktop adapters list unacknowledged outbox items.
- Let desktop adapters acknowledge an outbox item after they process it.
- Support filtering by `agentType` and `sessionId`.
- Keep existing iPhone and Watch behavior unchanged.
- Document that adapter-specific response application is a later layer.

Out of scope:

- Automatically clicking Codex Desktop or Claude Code UI controls.
- Guaranteeing delivery across helper restarts.
- Adding a persistent database.
- Streaming, websockets, push, or background retry workers.
- Changing the current request creation payloads.

## User Experience

For the end user, nothing changes on iPhone or Watch in this slice. The important product change is behind the scenes: after the user responds remotely, the desktop-side integration has a reliable place to fetch the decision.

This moves the product from "remote decision is stored in helper" to "remote decision is ready for the agent adapter to consume." The next slice can then focus on one specific adapter, such as a Codex control surface or a Claude Code-compatible response bridge.

## API Design

The existing response endpoint remains the same:

```http
POST /requests/:id/response
```

When that endpoint resolves a request, the store creates an outbox item.

List unacknowledged outbox items:

```http
GET /agent-responses
GET /agent-responses?agentType=codex-desktop
GET /agent-responses?agentType=claude-code&sessionId=session-1
```

Response shape:

```json
{
  "responses": [
    {
      "id": "response-outbox-1",
      "requestId": "request-1",
      "agentType": "codex-desktop",
      "projectName": "payments-api",
      "computerName": "work-mac",
      "sessionId": "session-1",
      "requestType": "approval",
      "title": "Allow shell",
      "response": {
        "requestId": "request-1",
        "action": "allow",
        "message": ""
      },
      "createdAt": "2026-06-17T03:00:00.000Z",
      "acknowledgedAt": null
    }
  ]
}
```

Acknowledge an outbox item:

```http
POST /agent-responses/:id/ack
```

Response shape:

```json
{
  "id": "response-outbox-1",
  "acknowledgedAt": "2026-06-17T03:01:00.000Z"
}
```

The list endpoint returns only unacknowledged items. Acknowledging an already acknowledged item should fail clearly with `response is already acknowledged`. Acknowledging a missing item should fail with `response not found`.

## Architecture

Keep this inside the existing in-memory helper store for the MVP.

- Extend `createRequestStore()` with an internal `responseOutbox` map and sequence counter.
- `resolve(input)` continues returning the resolved request for current clients.
- `resolve(input)` also appends a response outbox item derived from the resolved request and normalized response.
- Add `listAgentResponses(filters)` to return unacknowledged outbox items oldest first so adapters process decisions in the order users made them.
- Add `ackAgentResponse(id)` to mark an item acknowledged.
- Add two helper routes in `src/helper/server.js`.

No Swift code needs to change because the iPhone app already sends responses through the existing helper endpoint.

## Security and Safety

The outbox endpoints should use the same bearer-token authentication as `/requests`. This is acceptable for the MVP because the paired local user/device and local desktop helper share the same local trust boundary.

The outbox does not execute commands. It only exposes structured decisions that were already recorded through the existing response endpoint.

## Error Handling

Use the helper's existing JSON error style:

```json
{ "error": "response not found" }
```

Invalid filters should be conservative:

- Unknown `agentType` returns an empty list rather than an error.
- Missing `sessionId` means no session filter.
- Empty `sessionId` is treated as no session filter.

## Testing

Node tests should cover:

- Resolving a request creates one outbox item.
- Listing outbox items returns unacknowledged items oldest first.
- Listing can filter by `agentType`.
- Listing can filter by both `agentType` and `sessionId`.
- Acknowledging an item removes it from future list responses.
- Acknowledging a missing item returns a clear error through the store and server.
- Existing `/requests/:id/response` behavior remains compatible.
- Auth still protects outbox endpoints when enabled.

Swift tests are expected to stay unchanged because mobile clients use the existing response endpoint.

## Release Notes

README should document the adapter-facing response flow:

1. Phone or Watch sends `POST /requests/:id/response`.
2. Helper records the resolved request and creates an outbox item.
3. Desktop adapter polls `GET /agent-responses`.
4. Desktop adapter handles the response and calls `POST /agent-responses/:id/ack`.

The docs should clearly say this is not yet automatic Codex/Claude UI control.
