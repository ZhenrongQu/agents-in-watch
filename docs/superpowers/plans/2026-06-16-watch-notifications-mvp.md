# Watch Notifications MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schedule a local iPhone notification when the companion app discovers a new pending agent request.

**Architecture:** Add a `NotificationBridge` protocol to `AgentsInWatchMobileUI`, with a `UserNotificationBridge` implementation backed by UserNotifications where available. Inject the bridge into `CompanionViewModel`, request authorization on initialization, expose notification status to the UI, and notify only once per request id.

**Tech Stack:** Swift 6.1, SwiftUI, UserNotifications, Swift Testing, Swift Package Manager.

---

## File Structure

- `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/NotificationBridge.swift`: notification protocol, status model, no-op bridge, and UserNotifications-backed implementation.
- `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`: inject bridge, expose status, request authorization, notify for newly loaded request ids.
- `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/PendingRequestsView.swift`: render compact notification status row.
- `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`: fake bridge tests for authorization, deduping, and new request notification.
- `README.md`: document notification MVP scope and full-Xcode/manual verification limit.

---

### Task 1: Notification Bridge

**Files:**
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/NotificationBridge.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`

- [ ] **Step 1: Write failing tests**

Add a fake notification bridge to `CompanionViewModelTests.swift`:

```swift
private final class FakeNotificationBridge: NotificationBridge, @unchecked Sendable {
    private(set) var status: NotificationBridgeStatus
    private(set) var authorizationRequestCount = 0
    private(set) var notifiedRequests: [AgentRequest] = []
    private var statusHandler: (@Sendable (NotificationBridgeStatus) -> Void)?

    init(status: NotificationBridgeStatus = .notDetermined) {
        self.status = status
    }

    func requestAuthorization() async {
        authorizationRequestCount += 1
        status = .ready
        statusHandler?(.ready)
    }

    func notifyNewRequest(_ request: AgentRequest) async {
        notifiedRequests.append(request)
    }

    func setStatusHandler(_ handler: @escaping @Sendable (NotificationBridgeStatus) -> Void) {
        statusHandler = handler
    }
}
```

Add this test:

```swift
@Test func requestsNotificationAuthorizationOnStart() async {
    let notificationBridge = FakeNotificationBridge(status: .notDetermined)
    let model = CompanionViewModel(
        credentialStore: InMemoryPairingCredentialStore(),
        notificationBridge: notificationBridge
    )

    for _ in 0..<5 {
        await Task.yield()
    }

    #expect(notificationBridge.authorizationRequestCount == 1)
    #expect(model.notificationStatus == .ready)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
swift test --filter CompanionViewModelTests/requestsNotificationAuthorizationOnStart
```

Expected: fail because `NotificationBridge`, `NotificationBridgeStatus`, `notificationBridge`, and `notificationStatus` do not exist.

- [ ] **Step 3: Add bridge implementation**

Create `NotificationBridge.swift`:

```swift
import AgentsInWatchCore
import Foundation

#if canImport(UserNotifications)
import UserNotifications
#endif

public enum NotificationBridgeStatus: Equatable, Sendable {
    case unavailable
    case notDetermined
    case denied
    case ready

    public var title: String {
        switch self {
        case .unavailable:
            "Notifications Unavailable"
        case .notDetermined:
            "Notifications Need Permission"
        case .denied:
            "Notifications Off"
        case .ready:
            "Notifications Ready"
        }
    }

    public var detail: String {
        switch self {
        case .unavailable:
            "This environment cannot schedule local request alerts."
        case .notDetermined:
            "Allow notifications to get alerted when agents need attention."
        case .denied:
            "Enable notifications in Settings to receive request alerts."
        case .ready:
            "New agent requests can alert this iPhone and paired Watch."
        }
    }
}

public protocol NotificationBridge: Sendable {
    var status: NotificationBridgeStatus { get }
    func requestAuthorization() async
    func notifyNewRequest(_ request: AgentRequest) async
    func setStatusHandler(_ handler: @escaping @Sendable (NotificationBridgeStatus) -> Void)
}

public final class NoopNotificationBridge: NotificationBridge, @unchecked Sendable {
    public let status: NotificationBridgeStatus = .unavailable

    public init() {}

    public func requestAuthorization() async {}
    public func notifyNewRequest(_ request: AgentRequest) async {}
    public func setStatusHandler(_ handler: @escaping @Sendable (NotificationBridgeStatus) -> Void) {}
}

public enum DefaultNotificationBridgeFactory {
    public static func make() -> any NotificationBridge {
        #if canImport(UserNotifications)
        UserNotificationBridge()
        #else
        NoopNotificationBridge()
        #endif
    }
}

#if canImport(UserNotifications)
public final class UserNotificationBridge: NotificationBridge, @unchecked Sendable {
    private let center: UNUserNotificationCenter
    private var statusHandler: (@Sendable (NotificationBridgeStatus) -> Void)?

    public private(set) var status: NotificationBridgeStatus = .notDetermined

    public init(center: UNUserNotificationCenter = .current()) {
        self.center = center
        Task {
            await refreshStatus()
        }
    }

    public func requestAuthorization() async {
        do {
            _ = try await center.requestAuthorization(options: [.alert, .sound])
        } catch {
            updateStatus(.denied)
            return
        }
        await refreshStatus()
    }

    public func notifyNewRequest(_ request: AgentRequest) async {
        guard status == .ready else {
            return
        }
        let content = UNMutableNotificationContent()
        content.title = request.title
        content.body = request.watchSummary
        content.sound = .default

        let notificationRequest = UNNotificationRequest(
            identifier: "agents-in-watch-\(request.id)",
            content: content,
            trigger: nil
        )
        try? await center.add(notificationRequest)
    }

    public func setStatusHandler(_ handler: @escaping @Sendable (NotificationBridgeStatus) -> Void) {
        statusHandler = handler
    }

    private func refreshStatus() async {
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            updateStatus(.ready)
        case .denied:
            updateStatus(.denied)
        case .notDetermined:
            updateStatus(.notDetermined)
        @unknown default:
            updateStatus(.unavailable)
        }
    }

    private func updateStatus(_ nextStatus: NotificationBridgeStatus) {
        status = nextStatus
        statusHandler?(nextStatus)
    }
}
#endif
```

- [ ] **Step 4: Wire ViewModel authorization**

Modify `CompanionViewModel`:

- Add `@Published public private(set) var notificationStatus: NotificationBridgeStatus`.
- Add `private let notificationBridge: any NotificationBridge`.
- Add initializer parameter `notificationBridge: any NotificationBridge = DefaultNotificationBridgeFactory.make()`.
- Set `self.notificationStatus = notificationBridge.status`.
- Register `notificationBridge.setStatusHandler`.
- Start `Task { await notificationBridge.requestAuthorization() }` at the end of init.

- [ ] **Step 5: Run focused test**

Run:

```bash
swift test --filter CompanionViewModelTests/requestsNotificationAuthorizationOnStart
```

Expected: test passes.

- [ ] **Step 6: Commit**

```bash
git add mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/NotificationBridge.swift mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift
git commit -m "feat: add notification bridge"
```

---

### Task 2: Notify New Pending Requests

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`

- [ ] **Step 1: Write failing dedupe test**

Add this test:

```swift
@Test func notifiesOnlyNewPendingRequests() async {
    let firstRequest = sampleRequest(id: "request-1")
    let secondRequest = sampleRequest(id: "request-2")
    let fakeClient = FakeClient()
    let notificationBridge = FakeNotificationBridge(status: .ready)
    let store = InMemoryPairingCredentialStore(
        credential: StoredPairingCredential(
            helperURL: URL(string: "http://127.0.0.1:42731")!,
            bearerToken: "saved-token"
        )
    )
    fakeClient.pendingRequestResults = [
        [firstRequest],
        [firstRequest],
        [firstRequest, secondRequest]
    ]
    let model = CompanionViewModel(
        credentialStore: store,
        notificationBridge: notificationBridge,
        clientFactory: { _ in fakeClient }
    )

    await model.loadPendingRequests()
    await model.loadPendingRequests()
    await model.loadPendingRequests()

    #expect(notificationBridge.notifiedRequests.map(\.id) == ["request-1", "request-2"])
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
swift test --filter CompanionViewModelTests/notifiesOnlyNewPendingRequests
```

Expected: fail because no notifications are scheduled.

- [ ] **Step 3: Implement deduped notification scheduling**

In `CompanionViewModel`, add:

```swift
private var notifiedRequestIds: Set<String>
```

Initialize it as `[]`.

In `loadPendingRequestsFromClient()`, after assigning `pendingRequests`, call:

```swift
await notifyForNewPendingRequests(pendingRequests)
```

Add helper:

```swift
private func notifyForNewPendingRequests(_ requests: [AgentRequest]) async {
    for request in requests where !notifiedRequestIds.contains(request.id) {
        notifiedRequestIds.insert(request.id)
        await notificationBridge.notifyNewRequest(request)
    }
}
```

In `disconnect()`, add:

```swift
notifiedRequestIds.removeAll()
```

- [ ] **Step 4: Run focused and full Swift tests**

Run:

```bash
swift test --filter CompanionViewModelTests
swift test
```

Expected: all Swift tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift
git commit -m "feat: notify for new pending requests"
```

---

### Task 3: UI and Documentation

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/PendingRequestsView.swift`
- Modify: `README.md`

- [ ] **Step 1: Render notification status**

Add this section after the Watch status section in `PendingRequestsView`:

```swift
Section("Notifications") {
    Label(model.notificationStatus.title, systemImage: "bell")
        .font(.subheadline)
    Text(model.notificationStatus.detail)
        .font(.caption)
        .foregroundStyle(.secondary)
}
```

- [ ] **Step 2: Update README**

Update the feature list to include local request notifications. Update current limitations to say notification actions and background retry queues are still not implemented. Add one sentence to the iPhone App section explaining that the companion requests notification permission and schedules local alerts for newly discovered pending requests.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm test
swift test
plutil -lint mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatchWatch.xcscheme
```

Expected: all commands pass.

- [ ] **Step 4: Commit**

```bash
git add README.md mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/PendingRequestsView.swift
git commit -m "docs: document notification MVP"
```

---

## Self-Review

- Spec coverage: covers authorization request, status exposure, notification scheduling for new pending request ids, UI status, and README scope.
- Placeholder scan: no unresolved placeholders.
- Scope check: excludes notification actions, background reliable delivery, remote push notifications, Codex desktop adapter, and packaged installers.
- Type consistency: `NotificationBridgeStatus`, `notificationStatus`, and `notifyNewRequest(_:)` are used consistently across plan tasks.
