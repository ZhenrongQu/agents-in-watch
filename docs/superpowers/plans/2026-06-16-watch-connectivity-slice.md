# Watch Connectivity Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first Watch bridge slice so the iPhone companion can publish pending requests to a minimal Watch app request list.

**Architecture:** Keep the shared payload format in `AgentsInWatchCore`, bridge publishing in `AgentsInWatchMobileUI`, and Watch-specific display state in a new `AgentsInWatchWatchUI` package target. The iPhone ViewModel publishes request-list snapshots after refreshes and clears the Watch snapshot on disconnect. A minimal Xcode watchOS app target hosts the Watch UI.

**Tech Stack:** Swift 6.1, Swift Package Manager, SwiftUI, WatchConnectivity, Testing, Xcode project files.

---

## Scope

This plan implements:

- Codable request models so pending requests can be encoded for Watch transfer.
- A shared `WatchConnectivityPayload` helper that creates and decodes application-context dictionaries.
- A `WatchRequestBridge` protocol with no-op and WatchConnectivity-backed implementations.
- ViewModel publication of pending requests to the bridge after refresh/respond and clearing on disconnect.
- A new `AgentsInWatchWatchUI` package target with a tiny request-list ViewModel and SwiftUI list view.
- A minimal watchOS app source target and shared scheme in the Xcode project.
- README updates documenting the new Watch slice.

This plan does not implement Watch-to-iPhone responses, notifications, complication support, paired-device install automation, or full `xcodebuild` validation because this machine only has Xcode Command Line Tools active.

## File Structure

- Modify `mobile/ios/AgentsInWatchCore/Package.swift`: add `AgentsInWatchWatchUI` product, target, and tests.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/Models.swift`: make shared request models `Codable`.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/WatchConnectivityPayload.swift`: shared payload encoding/decoding.
- Create `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchCoreTests/WatchConnectivityPayloadTests.swift`: payload round-trip tests.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/WatchRequestBridge.swift`: bridge protocol, no-op bridge, default factory, WatchConnectivity implementation.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`: inject and publish to the bridge.
- Modify `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`: fake bridge assertions.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsViewModel.swift`: Watch state.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsView.swift`: Watch request list UI.
- Create `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchWatchUITests/WatchRequestsViewModelTests.swift`: Watch state tests.
- Create `mobile/ios/AgentsInWatchWatchApp/AgentsInWatchWatchApp.swift`: watchOS app entry point.
- Create `mobile/ios/AgentsInWatchWatchApp/Assets.xcassets/Contents.json`: asset catalog root.
- Create `mobile/ios/AgentsInWatchWatchApp/Assets.xcassets/AccentColor.colorset/Contents.json`: accent color.
- Modify `mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj`: add watchOS app target linked to `AgentsInWatchWatchUI`.
- Create `mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatchWatch.xcscheme`: Watch scheme.
- Modify `README.md`: document the Watch slice status.

## Task 1: Shared Watch Payload

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Package.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/Models.swift`
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/WatchConnectivityPayload.swift`
- Create: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchCoreTests/WatchConnectivityPayloadTests.swift`

- [ ] **Step 1: Write failing payload tests**

Create tests proving pending requests round-trip through a Watch application context.

- [ ] **Step 2: Run the tests and confirm failure**

Run: `swift test --filter WatchConnectivityPayloadTests` from `mobile/ios/AgentsInWatchCore`.

Expected: FAIL because `WatchConnectivityPayload` does not exist.

- [ ] **Step 3: Implement Codable request models and payload helper**

Make `PendingRequestsResponse`, `AgentRequest`, `AgentType`, `RequestType`, `RiskLevel`, and `RequestStatus` conform to `Codable`. Add `WatchConnectivityPayload` with key `pendingRequestsJSON`, `makeApplicationContext(requests:)`, and `decodeRequests(from:)`.

- [ ] **Step 4: Run Swift tests**

Run: `swift test` from `mobile/ios/AgentsInWatchCore`.

Expected: PASS.

- [ ] **Step 5: Commit**

Commit as `feat: add watch request payload`.

## Task 2: iPhone Watch Bridge

**Files:**
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/WatchRequestBridge.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`

- [ ] **Step 1: Write failing bridge tests**

Add a fake bridge to ViewModel tests and assert that `loadPendingRequests()` publishes the loaded request list, `send(action:for:)` publishes the reloaded list, and `disconnect()` publishes an empty list.

- [ ] **Step 2: Run tests and confirm failure**

Run: `swift test --filter CompanionViewModelTests`.

Expected: FAIL because `CompanionViewModel` does not accept or call a Watch bridge.

- [ ] **Step 3: Implement bridge and ViewModel publishing**

Add `WatchRequestBridge`, `NoopWatchRequestBridge`, `DefaultWatchRequestBridgeFactory`, and a conditional `WatchConnectivityRequestBridge`. Inject the bridge into `CompanionViewModel`, publish after pending requests load, and clear on disconnect.

- [ ] **Step 4: Run Swift tests**

Run: `swift test`.

Expected: PASS.

- [ ] **Step 5: Commit**

Commit as `feat: publish companion requests to watch bridge`.

## Task 3: Watch UI Package

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Package.swift`
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsViewModel.swift`
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsView.swift`
- Create: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchWatchUITests/WatchRequestsViewModelTests.swift`

- [ ] **Step 1: Write failing Watch UI tests**

Test that `WatchRequestsViewModel` starts empty and can apply a Watch application context into decoded pending requests.

- [ ] **Step 2: Run tests and confirm failure**

Run: `swift test --filter WatchRequestsViewModelTests`.

Expected: FAIL because the Watch UI target does not exist.

- [ ] **Step 3: Add Watch UI package target and implementation**

Add `AgentsInWatchWatchUI` product, target, and test target. Implement a small `WatchRequestsViewModel` and `WatchRequestsView` that displays empty state or request cards.

- [ ] **Step 4: Run Swift tests**

Run: `swift test`.

Expected: PASS.

- [ ] **Step 5: Commit**

Commit as `feat: add watch request list UI`.

## Task 4: Xcode Watch App Target and Docs

**Files:**
- Create: `mobile/ios/AgentsInWatchWatchApp/AgentsInWatchWatchApp.swift`
- Create: `mobile/ios/AgentsInWatchWatchApp/Assets.xcassets/Contents.json`
- Create: `mobile/ios/AgentsInWatchWatchApp/Assets.xcassets/AccentColor.colorset/Contents.json`
- Modify: `mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj`
- Create: `mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatchWatch.xcscheme`
- Modify: `README.md`

- [ ] **Step 1: Add Watch app source**

Create a watchOS app entry point that renders `WatchRequestsView`.

- [ ] **Step 2: Add Watch target and scheme**

Update the Xcode project with an `AgentsInWatchWatch` watchOS app target linked to the local `AgentsInWatchWatchUI` package product. Add a shared scheme for the Watch app.

- [ ] **Step 3: Verify project files**

Run:

```bash
plutil -lint mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatchWatch.xcscheme
```

Expected: project file reports `OK`; both schemes have valid XML.

- [ ] **Step 4: Run final tests**

Run `npm test` from the repo root and `swift test` from `mobile/ios/AgentsInWatchCore`.

Expected: PASS.

- [ ] **Step 5: Commit**

Commit as `feat: add watch app target`.

## Verification Notes

This machine currently has Xcode Command Line Tools active, not full Xcode. A later pass on a full Xcode installation should run:

```bash
xcodebuild -project mobile/ios/AgentsInWatch.xcodeproj -scheme AgentsInWatch -destination 'platform=iOS Simulator,name=iPhone 15' build
xcodebuild -project mobile/ios/AgentsInWatch.xcodeproj -scheme AgentsInWatchWatch -destination 'platform=watchOS Simulator,name=Apple Watch Series 9 (45mm)' build
```
