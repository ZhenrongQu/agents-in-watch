# Foreground Auto Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically refresh pending requests while the iPhone companion is connected and open.

**Architecture:** Add an `AutoRefreshDriver` protocol with a task-based default implementation and a small `AutoRefreshStatus` model. Inject the driver into `CompanionViewModel`, start it when the model becomes connected, stop it on disconnect, and route driver ticks through the existing pending-request loading path.

**Tech Stack:** Swift 6.1, SwiftUI, Foundation `Task.sleep`, Swift Testing, Swift Package Manager.

---

## File Structure

- `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/AutoRefreshDriver.swift`: auto-refresh status model, protocol, no-op driver, and task-loop driver.
- `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`: inject driver, expose `autoRefreshStatus`, start/stop refresh, handle ticks.
- `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/PendingRequestsView.swift`: render auto-refresh status.
- `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`: fake driver tests.
- `README.md`: document foreground-only auto refresh scope.

---

### Task 1: Auto Refresh Driver

**Files:**
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/AutoRefreshDriver.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`

- [ ] **Step 1: Write failing tests and fake driver**

Add this fake to `CompanionViewModelTests.swift`:

```swift
private final class FakeAutoRefreshDriver: AutoRefreshDriver, @unchecked Sendable {
    private(set) var isRunning = false
    private(set) var startCallCount = 0
    private(set) var stopCallCount = 0
    private var tickHandler: (@Sendable () -> Void)?

    func setTickHandler(_ handler: @escaping @Sendable () -> Void) {
        tickHandler = handler
    }

    func start() {
        isRunning = true
        startCallCount += 1
    }

    func stop() {
        isRunning = false
        stopCallCount += 1
    }

    func simulateTick() {
        tickHandler?()
    }
}
```

Add this test:

```swift
@Test func startsAutoRefreshWhenCredentialExists() {
    let autoRefreshDriver = FakeAutoRefreshDriver()
    let store = InMemoryPairingCredentialStore(
        credential: StoredPairingCredential(
            helperURL: URL(string: "http://127.0.0.1:42731")!,
            bearerToken: "saved-token"
        )
    )
    let model = CompanionViewModel(
        credentialStore: store,
        autoRefreshDriver: autoRefreshDriver,
        clientFactory: { _ in FakeClient() }
    )

    #expect(model.phase == .connected)
    #expect(autoRefreshDriver.isRunning)
    #expect(autoRefreshDriver.startCallCount == 1)
    #expect(model.autoRefreshStatus.isRunning)
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
swift test --filter CompanionViewModelTests/startsAutoRefreshWhenCredentialExists
```

Expected: fail because `AutoRefreshDriver`, `autoRefreshDriver`, and `autoRefreshStatus` do not exist.

- [ ] **Step 3: Add driver and status model**

Create `AutoRefreshDriver.swift`:

```swift
import Foundation

public struct AutoRefreshStatus: Equatable, Sendable {
    public let isRunning: Bool
    public let lastRefreshedAt: Date?

    public static let stopped = AutoRefreshStatus(isRunning: false, lastRefreshedAt: nil)

    public var title: String {
        isRunning ? "Auto Refresh On" : "Auto Refresh Off"
    }

    public var detail: String {
        guard isRunning else {
            return "Open and connect the companion to poll for new agent requests."
        }
        guard let lastRefreshedAt else {
            return "Checking for new requests while this app is open."
        }
        return "Last checked at \(lastRefreshedAt.formatted(date: .omitted, time: .shortened))."
    }
}

public protocol AutoRefreshDriver: Sendable {
    var isRunning: Bool { get }
    func setTickHandler(_ handler: @escaping @Sendable () -> Void)
    func start()
    func stop()
}

public final class NoopAutoRefreshDriver: AutoRefreshDriver, @unchecked Sendable {
    public let isRunning = false

    public init() {}

    public func setTickHandler(_ handler: @escaping @Sendable () -> Void) {}
    public func start() {}
    public func stop() {}
}

public final class TaskAutoRefreshDriver: AutoRefreshDriver, @unchecked Sendable {
    private let intervalNanoseconds: UInt64
    private var task: Task<Void, Never>?
    private var tickHandler: (@Sendable () -> Void)?

    public var isRunning: Bool {
        task != nil
    }

    public init(intervalSeconds: UInt64 = 15) {
        self.intervalNanoseconds = intervalSeconds * 1_000_000_000
    }

    deinit {
        stop()
    }

    public func setTickHandler(_ handler: @escaping @Sendable () -> Void) {
        tickHandler = handler
    }

    public func start() {
        guard task == nil else {
            return
        }
        task = Task { [intervalNanoseconds] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: intervalNanoseconds)
                guard !Task.isCancelled else {
                    return
                }
                tickHandler?()
            }
        }
    }

    public func stop() {
        task?.cancel()
        task = nil
    }
}
```

- [ ] **Step 4: Wire minimal ViewModel start**

Modify `CompanionViewModel`:

- Add `@Published public private(set) var autoRefreshStatus: AutoRefreshStatus`.
- Add `private let autoRefreshDriver: any AutoRefreshDriver`.
- Add initializer parameter `autoRefreshDriver: any AutoRefreshDriver = TaskAutoRefreshDriver()`.
- Set `self.autoRefreshStatus = .stopped`.
- Register `autoRefreshDriver.setTickHandler`.
- Call `startAutoRefresh()` whenever `phase` becomes `.connected`.
- Add `stopAutoRefresh()` to `disconnect()`.

- [ ] **Step 5: Run focused tests**

Run:

```bash
swift test --filter CompanionViewModelTests/startsAutoRefreshWhenCredentialExists
```

Expected: test passes.

- [ ] **Step 6: Commit**

```bash
git add mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/AutoRefreshDriver.swift mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift
git commit -m "feat: add foreground auto refresh driver"
```

---

### Task 2: Auto Refresh Tick Behavior

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`

- [ ] **Step 1: Write failing tick and disconnect tests**

Add these tests:

```swift
@Test func autoRefreshTickLoadsPendingRequests() async {
    let request = sampleRequest(id: "request-1")
    let fakeClient = FakeClient()
    let autoRefreshDriver = FakeAutoRefreshDriver()
    let store = InMemoryPairingCredentialStore(
        credential: StoredPairingCredential(
            helperURL: URL(string: "http://127.0.0.1:42731")!,
            bearerToken: "saved-token"
        )
    )
    fakeClient.pendingRequestResults = [[request]]
    let model = CompanionViewModel(
        credentialStore: store,
        autoRefreshDriver: autoRefreshDriver,
        clientFactory: { _ in fakeClient }
    )

    autoRefreshDriver.simulateTick()
    for _ in 0..<5 {
        await Task.yield()
    }

    #expect(fakeClient.listPendingRequestsCallCount == 1)
    #expect(model.pendingRequests == [request])
    #expect(model.autoRefreshStatus.lastRefreshedAt != nil)
}

@Test func disconnectStopsAutoRefresh() {
    let autoRefreshDriver = FakeAutoRefreshDriver()
    let store = InMemoryPairingCredentialStore(
        credential: StoredPairingCredential(
            helperURL: URL(string: "http://127.0.0.1:42731")!,
            bearerToken: "saved-token"
        )
    )
    let model = CompanionViewModel(
        credentialStore: store,
        autoRefreshDriver: autoRefreshDriver,
        clientFactory: { _ in FakeClient() }
    )

    model.disconnect()

    #expect(autoRefreshDriver.isRunning == false)
    #expect(autoRefreshDriver.stopCallCount == 1)
    #expect(model.autoRefreshStatus == .stopped)
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
swift test --filter CompanionViewModelTests/autoRefreshTickLoadsPendingRequests
swift test --filter CompanionViewModelTests/disconnectStopsAutoRefresh
```

Expected: fail until tick handling and status update are implemented.

- [ ] **Step 3: Implement tick handling**

In `CompanionViewModel`, add:

```swift
private func startAutoRefresh() {
    autoRefreshDriver.start()
    autoRefreshStatus = AutoRefreshStatus(isRunning: true, lastRefreshedAt: autoRefreshStatus.lastRefreshedAt)
}

private func stopAutoRefresh() {
    autoRefreshDriver.stop()
    autoRefreshStatus = .stopped
}

private func handleAutoRefreshTick() async {
    guard case .connected = phase, !isLoading else {
        return
    }
    await runLoading {
        try await loadPendingRequestsFromClient()
        autoRefreshStatus = AutoRefreshStatus(isRunning: true, lastRefreshedAt: Date())
    }
}
```

Register the tick handler in `init`:

```swift
autoRefreshDriver.setTickHandler { [weak self] in
    Task { @MainActor [weak self] in
        await self?.handleAutoRefreshTick()
    }
}
```

Ensure `startAutoRefresh()` is called after saved credential restore and after approved pairing/refresh transitions to connected.

- [ ] **Step 4: Run Swift tests**

Run:

```bash
swift test --filter CompanionViewModelTests
swift test
```

Expected: all Swift tests pass.

- [ ] **Step 5: Commit**

```bash
git add mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift
git commit -m "feat: refresh pending requests in foreground"
```

---

### Task 3: UI and Documentation

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/PendingRequestsView.swift`
- Modify: `README.md`

- [ ] **Step 1: Render auto refresh status**

Add this section after the notification section in `PendingRequestsView`:

```swift
Section("Auto Refresh") {
    Label(model.autoRefreshStatus.title, systemImage: "arrow.triangle.2.circlepath")
        .font(.subheadline)
    Text(model.autoRefreshStatus.detail)
        .font(.caption)
        .foregroundStyle(.secondary)
}
```

- [ ] **Step 2: Update README**

Update the feature list to mention foreground auto refresh. Add one sentence to the iPhone App section explaining that connected companion sessions poll for requests while the app is open. Clarify that background delivery guarantees are still out of scope.

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
git commit -m "docs: document foreground auto refresh"
```

---

## Self-Review

- Spec coverage: covers foreground polling start, stop, tick behavior, UI status, and documentation.
- Placeholder scan: no unresolved placeholders.
- Scope check: excludes iOS background tasks, push notifications, retry queues, notification actions, Codex desktop adapter, and installers.
- Type consistency: `AutoRefreshDriver`, `AutoRefreshStatus`, and `autoRefreshStatus` are used consistently.
