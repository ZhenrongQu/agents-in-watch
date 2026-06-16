# Watch Response Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Watch send allow, deny, pause, and reply actions back to the iPhone companion so the iPhone can answer the Desktop Helper.

**Architecture:** Add a shared Codable response payload in `AgentsInWatchCore`. Extend the iPhone Watch bridge with an inbound response handler that routes messages to `CompanionViewModel`. Add a Watch-side response bridge and wire Watch row buttons to it. Keep real WatchConnectivity behind protocols so tests use fake bridges.

**Tech Stack:** Swift 6.1, Swift Package Manager, SwiftUI, WatchConnectivity, Testing.

---

## Scope

This plan implements:

- A shared `WatchRequestResponse` model and message dictionary payload.
- iPhone-side response handling in `WatchRequestBridge` and `CompanionViewModel`.
- Watch-side response sending from `WatchRequestsViewModel`.
- Watch UI buttons for allow, deny, pause, and reply.
- Unit tests for payload encoding, iPhone routing, and Watch response sending.
- README status update.

This plan does not implement voice dictation, notification actions, background delivery guarantees, retry queues, or simulator UI automation.

## File Structure

- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/WatchConnectivityPayload.swift`: add response model and message helpers.
- Modify `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchCoreTests/WatchConnectivityPayloadTests.swift`: add response round-trip tests.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/WatchRequestBridge.swift`: add inbound response handler support.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`: subscribe to Watch responses and answer matching pending requests.
- Modify `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`: assert Watch response routes to helper response.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchResponseBridge.swift`: Watch-side response bridge protocol and WatchConnectivity sender.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsViewModel.swift`: inject response bridge and send actions.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsView.swift`: add action buttons.
- Modify `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchWatchUITests/WatchRequestsViewModelTests.swift`: assert Watch sends response payloads.
- Modify `README.md`: document Watch response status.

## Task 1: Shared Watch Response Payload

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/WatchConnectivityPayload.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchCoreTests/WatchConnectivityPayloadTests.swift`

- [ ] **Step 1: Write failing tests**

Add tests for encoding and decoding a `WatchRequestResponse` with `requestId`, `action`, and optional `message`.

- [ ] **Step 2: Run test and confirm failure**

Run: `swift test --filter WatchConnectivityPayloadTests`

Expected: FAIL because `WatchRequestResponse` and response payload helpers do not exist.

- [ ] **Step 3: Implement payload**

Add `WatchRequestResponse` and helpers:

```swift
public struct WatchRequestResponse: Codable, Equatable, Sendable {
    public let requestId: String
    public let action: RequestAction
    public let message: String?
}
```

Add `requestResponseKey`, `makeMessage(response:)`, and `decodeResponse(from:)`.

- [ ] **Step 4: Verify**

Run: `swift test`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit as `feat: add watch response payload`.

## Task 2: iPhone Routes Watch Responses

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/WatchRequestBridge.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`

- [ ] **Step 1: Write failing ViewModel test**

Add a test that loads a pending request, simulates a Watch response for that request, and asserts the fake helper receives the same action.

- [ ] **Step 2: Run test and confirm failure**

Run: `swift test --filter CompanionViewModelTests`

Expected: FAIL because the bridge cannot register or simulate response handling yet.

- [ ] **Step 3: Implement response routing**

Extend `WatchRequestBridge` with `setResponseHandler(_:)`. The WatchConnectivity implementation decodes response messages in `session(_:didReceiveMessage:)`. `CompanionViewModel` registers a handler that finds the request by ID and calls `send(action:for:message:)` on the main actor.

- [ ] **Step 4: Verify**

Run: `swift test`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit as `feat: route watch responses through companion`.

## Task 3: Watch Sends Responses

**Files:**
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchResponseBridge.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsViewModel.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsView.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchWatchUITests/WatchRequestsViewModelTests.swift`

- [ ] **Step 1: Write failing Watch UI tests**

Add a fake response bridge and assert `WatchRequestsViewModel.send(action:for:)` sends the correct `WatchRequestResponse`.

- [ ] **Step 2: Run test and confirm failure**

Run: `swift test --filter WatchRequestsViewModelTests`

Expected: FAIL because the Watch response bridge and ViewModel method do not exist.

- [ ] **Step 3: Implement Watch response sending**

Add `WatchResponseBridge`, `NoopWatchResponseBridge`, and `WatchConnectivityResponseBridge`. Inject the bridge into `WatchRequestsViewModel` and expose `send(action:for:message:)`. Add action buttons to `WatchRequestsView`.

- [ ] **Step 4: Verify**

Run: `swift test`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit as `feat: send watch request responses`.

## Task 4: Documentation and Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Document that Watch-side allow, deny, pause, and reply actions now send response messages to the iPhone companion, while notification actions and background retry queues are still not implemented.

- [ ] **Step 2: Run final verification**

Run:

```bash
npm test
swift test
plutil -lint mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatchWatch.xcscheme
```

Expected: all pass.

- [ ] **Step 3: Commit**

Commit as `docs: document watch response slice`.

## Verification Notes

This machine has Xcode Command Line Tools active, not full Xcode, so app target builds still need a later full-Xcode verification pass.
