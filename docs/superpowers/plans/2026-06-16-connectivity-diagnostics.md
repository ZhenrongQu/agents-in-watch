# Connectivity Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show lightweight iPhone and Watch connectivity diagnostics so real-device Xcode testing can quickly identify where pairing or WatchConnectivity is stuck.

**Architecture:** Add small status snapshots to the existing iPhone `WatchRequestBridge` and Watch `WatchResponseBridge` protocols. ViewModels observe these bridge statuses and SwiftUI views render compact status rows. Tests use fake bridges to verify status propagation without requiring real WatchConnectivity sessions.

**Tech Stack:** Swift 6.1, Swift Package Manager, SwiftUI, WatchConnectivity, Testing.

---

## Scope

This plan implements:

- iPhone-side Watch bridge status snapshot and status updates.
- Companion ViewModel exposure of Watch bridge diagnostics.
- iPhone pending-requests screen status section.
- Watch-side response bridge status snapshot and status updates.
- Watch ViewModel exposure of response bridge diagnostics.
- Watch request-list status section.
- README update describing diagnostics and full Xcode verification limits.

This plan does not implement simulator automation, real-device screenshots, reconnect retry queues, or notification delivery diagnostics.

## File Structure

- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/WatchRequestBridge.swift`: add `WatchRequestBridgeStatus` and status handler support.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`: expose `watchStatus`.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/PendingRequestsView.swift`: render a compact Watch status section.
- Modify `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`: assert status propagation.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchResponseBridge.swift`: add `WatchResponseBridgeStatus` and status handler support.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsViewModel.swift`: expose `responseStatus`.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchWatchUI/WatchRequestsView.swift`: render response bridge status.
- Modify `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchWatchUITests/WatchRequestsViewModelTests.swift`: assert status propagation.
- Modify `README.md`: document diagnostics.

## Task 1: iPhone Watch Bridge Diagnostics

**Files:**
- Modify `WatchRequestBridge.swift`
- Modify `CompanionViewModel.swift`
- Modify `PendingRequestsView.swift`
- Modify `CompanionViewModelTests.swift`

- [ ] **Step 1: Write failing tests**

Add a fake bridge status to `FakeWatchRequestBridge`, assert `CompanionViewModel.watchStatus` starts from the bridge status, and assert simulated status changes update the ViewModel.

- [ ] **Step 2: Run test and confirm failure**

Run: `swift test --filter CompanionViewModelTests`

Expected: FAIL because `watchStatus` and bridge status APIs do not exist.

- [ ] **Step 3: Implement iPhone diagnostics**

Add `WatchRequestBridgeStatus` with `title` and `detail`, add `status` and `setStatusHandler(_:)` to `WatchRequestBridge`, update the WatchConnectivity bridge during activation, and render status in `PendingRequestsView`.

- [ ] **Step 4: Verify**

Run: `swift test`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit as `feat: add iPhone watch diagnostics`.

## Task 2: Watch Response Bridge Diagnostics

**Files:**
- Modify `WatchResponseBridge.swift`
- Modify `WatchRequestsViewModel.swift`
- Modify `WatchRequestsView.swift`
- Modify `WatchRequestsViewModelTests.swift`

- [ ] **Step 1: Write failing tests**

Add a fake Watch response bridge status and assert `WatchRequestsViewModel.responseStatus` starts from it and updates when the fake bridge emits a status change.

- [ ] **Step 2: Run test and confirm failure**

Run: `swift test --filter WatchRequestsViewModelTests`

Expected: FAIL because `responseStatus` and bridge status APIs do not exist.

- [ ] **Step 3: Implement Watch diagnostics**

Add `WatchResponseBridgeStatus`, expose `status` and `setStatusHandler(_:)`, update the WatchConnectivity response bridge on activation, and render status in the Watch list.

- [ ] **Step 4: Verify**

Run: `swift test`

Expected: PASS.

- [ ] **Step 5: Commit**

Commit as `feat: add watch response diagnostics`.

## Task 3: Documentation and Final Verification

**Files:**
- Modify `README.md`

- [ ] **Step 1: Update README**

Document that iPhone and Watch now show lightweight connectivity diagnostics, and note that full `xcodebuild` still requires full Xcode rather than Command Line Tools.

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

Commit as `docs: document connectivity diagnostics`.

## Verification Notes

This machine has Xcode Command Line Tools active, not full Xcode, so simulator and real-device builds still need a later full-Xcode verification pass.
