# Agents in Watch MVP Design

## Summary

Agents in Watch is a free, open-source Apple Watch companion for developers who run AI coding agents on their computer. Its first version helps users leave their desk without blocking agent progress. When Codex desktop or Claude Code needs a small human decision, the request is sent to the user's Apple Watch so they can approve, reject, pause, or send a short reply.

The MVP is not a remote desktop, terminal replacement, or full IDE controller. It is a focused, local-first approval and short-reply tool.

## Assumptions

- The user wants a free GitHub project that other developers can install and inspect.
- The first version should favor trust and reliability over broad computer-control features.
- The user accepts a Watch app, iPhone companion app, and Desktop Helper as separate components.
- The first public version can require developer-style installation instead of App Store distribution.
- Codex desktop support depends on a stable local integration surface discovered during implementation. The product should fail closed rather than silently rely on fragile UI automation.

## Product Goals

- Let users respond to common agent blockers without sitting at the computer.
- Support Codex desktop and Claude Code as the first two agent environments.
- Make the first public version usable by other developers from GitHub.
- Keep the default experience conservative, understandable, and safe.
- Avoid requiring a hosted backend for the MVP.

## Non-Goals

- Full remote desktop control.
- Arbitrary remote shell input.
- Team collaboration or multi-user workflows.
- Cloud accounts, cloud sync, subscriptions, or hosted relay infrastructure.
- Default UI automation that blindly clicks IDE or desktop buttons.
- App Store polish on day one.

## Target User

The first target user is a developer who regularly runs Codex desktop or Claude Code, leaves the desk while agents work, and returns only because the agent needs a yes/no decision or a short instruction. The user is comfortable installing a GitHub project, building an iPhone/Watch app from source, and running a desktop helper.

## MVP Product Flow

1. The user starts Codex desktop or Claude Code on their Mac or Windows machine.
2. The user starts the Agents in Watch Desktop Helper.
3. The iPhone companion app pairs with the Desktop Helper using a QR code or pairing code.
4. The Apple Watch app follows the iPhone companion app.
5. When an agent blocks on a small decision, the Desktop Helper creates a pending request.
6. The iPhone app receives the request over the local network and forwards a compact notification to the Watch.
7. The Watch shows the agent name, project name, requested action, and short context.
8. The user chooses allow, deny, pause, or sends a short text/voice reply.
9. The reply is routed back to the correct agent session.
10. The agent continues or stops according to the user's response.

If the Watch screen cannot show enough context, the user opens the iPhone app for more detail.

## MVP Components

### Desktop Helper

The Desktop Helper runs on macOS and Windows. It owns local agent integrations, pairing, session state, and the local API used by the iPhone app.

Responsibilities:

- Detect supported agent sessions.
- Convert agent blockers into a common pending-request model.
- Track which request belongs to which agent session.
- Expose local-network pairing and request APIs.
- Receive Watch/iPhone responses and route them back to the correct adapter.
- Show local connection status and recent events.

The helper must not expose arbitrary shell execution as a default feature. It should only expose scoped responses to pending agent requests.

### iPhone Companion App

The iPhone app bridges the computer and the Watch.

Responsibilities:

- Pair with the Desktop Helper through QR code or pairing code.
- Show computer connection state.
- Show pending requests with more context than the Watch can fit.
- Send user responses back to the Desktop Helper.
- Bridge notifications and request state to the Apple Watch app.

The MVP is local-first. The iPhone app should be designed so a future cloud relay can replace the local transport, but the first version does not require one.

### Apple Watch App

The Watch app is the fast decision surface.

Responsibilities:

- Alert the user when an agent needs attention.
- Show a compact request card.
- Support allow, deny, pause, and short reply.
- Support dictated short replies when watchOS input allows it.
- Show recent pending requests.

The Watch app should not attempt to show full terminal logs. It should provide a clear summary and hand off to the iPhone for longer context.

## Agent Integrations

### Claude Code Adapter

Claude Code is the best first integration candidate because it has official hooks. The adapter should prefer supported Claude Code lifecycle events such as permission requests, notifications, stop/idle events, and user-input events where available.

The adapter should treat Claude Code hooks as the primary integration surface instead of screen scraping.

References:

- https://code.claude.com/docs/en/hooks

### Codex Desktop Adapter

The Codex desktop adapter should be conservative. The project should not assume a stable public Codex desktop control API until implementation verifies one.

The first implementation should define the adapter boundary and support the safest available local mechanism. If the only available method is UI automation, it should be explicit opt-in, clearly labeled experimental, and not required for the core product promise.

## Common Request Model

All agent adapters should translate their events into a shared request model before the data reaches iPhone or Watch.

Fields:

- Request ID.
- Agent type, such as `claude-code` or `codex-desktop`.
- Project or workspace name.
- Computer name.
- Session ID.
- Request type: approval, short reply, pause, notification.
- Short title.
- Short summary for Watch.
- Longer context for iPhone.
- Available actions.
- Risk level.
- Created time.
- Expiration time, if any.

This model keeps Watch and iPhone UI independent from specific agent internals.

## Safety Rules

The product's safety posture is conservative by default.

- Every Watch approval must show what the agent wants to do.
- The Watch must not show a vague yes/no prompt without context.
- High-risk actions should not be one-tap approved by default.
- Approval applies only to the current request, not future similar requests.
- Short replies are routed only to the current agent session.
- The Desktop Helper must require local confirmation when pairing a new iPhone/Watch.
- MVP data should stay on the local network by default.
- Documentation must explain that the project helps route approvals, but does not judge whether code or commands are safe.

High-risk examples include deleting files, changing system configuration, accessing secrets, installing unknown dependencies, or running unknown scripts.

## Installation and Release

The first public release should be positioned as an open-source developer tool.

GitHub repository contents:

- Source code for Desktop Helper, iPhone app, and Watch app.
- README with installation steps.
- Architecture overview.
- Security model and limitations.
- Supported-agent matrix.
- Troubleshooting guide.

Initial install expectation:

- Desktop Helper install instructions for macOS and Windows.
- iPhone/Watch app build-from-source instructions.
- Later versions can consider TestFlight or App Store distribution.

First-run pairing:

1. User starts the Desktop Helper.
2. Desktop Helper shows a QR code or pairing code.
3. User opens the iPhone app and pairs with the computer.
4. User confirms the pairing on the computer.
5. Watch app becomes available through the iPhone app.

## Technical Direction

The MVP should use a local-first architecture:

- Desktop Helper as the source of truth for agent sessions and pending requests.
- Local-network discovery and encrypted pairing between iPhone and Desktop Helper.
- iPhone-to-Watch communication using Apple platform capabilities.
- Adapter-based agent integrations so Claude Code and Codex desktop can evolve independently.
- A transport interface that can later support an optional cloud relay.

Apple platform implementation should be based on current platform capabilities such as WatchConnectivity, UserNotifications, and Network.framework.

References:

- https://developer.apple.com/documentation/watchconnectivity/wcsession
- https://developer.apple.com/documentation/usernotifications
- https://developer.apple.com/documentation/network

## Open Questions for Implementation

- Which local transport gives the best balance of reliability and setup simplicity for iPhone-to-Desktop Helper pairing.
- Which Codex desktop integration surfaces are stable enough to support in a public MVP.
- Whether Claude Code hooks can cover both permission approvals and short natural-language replies cleanly.
- How much request context can fit on Watch before the user experience becomes too dense.
- Which packaging path is simplest for macOS and Windows Desktop Helper distribution.

These questions should be answered during implementation planning and early technical spikes.

## Success Criteria

The MVP is successful when:

- A developer can run Claude Code, leave the desk, receive a permission or short-reply request on Apple Watch, respond, and see Claude Code continue correctly.
- A developer can run Codex desktop and use the safest verified adapter path available in the MVP. If a requested Codex action cannot be handled safely, the product reports that clearly instead of attempting hidden UI automation.
- The same product structure can support Claude Code and Codex desktop without changing the Watch or iPhone request UI.
- A new developer can follow the GitHub README to run the system locally.
- Pairing requires local user confirmation.
- The product never exposes arbitrary remote shell control as a default capability.
