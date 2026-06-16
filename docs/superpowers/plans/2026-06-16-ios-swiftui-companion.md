# iOS SwiftUI Companion Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first SwiftUI companion UI slice: a testable view model and minimal views for entering helper info, pairing, and displaying pending agent requests.

**Architecture:** Extend the existing Swift Package with a second library target, `AgentsInWatchMobileUI`, that depends on `AgentsInWatchCore`. Keep networking behind a small `HelperClientProtocol` so UI state can be tested without real network or simulator dependencies. Build quiet, utilitarian SwiftUI screens that map directly to the MVP workflow.

**Tech Stack:** Swift 6.1+, Swift Package Manager, SwiftUI, Testing, Foundation.

---

## Scope

This plan implements:

- A protocol abstraction for the existing `HelperClient`.
- A `CompanionViewModel` that owns helper URL, pairing code, device name, auth token state, pending requests, loading state, and user-facing errors.
- SwiftUI views for connection setup, pairing status, pending request list, and request actions.
- Unit tests for the ViewModel using a fake client.
- README update explaining the SwiftUI package target.

This plan does not implement a full Xcode iOS app target, QR scanning, Keychain persistence, WatchConnectivity, push notifications, visual snapshot tests, or simulator automation.

## File Structure

- Modify `mobile/ios/AgentsInWatchCore/Package.swift`: add `AgentsInWatchMobileUI` library product, target, and tests.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/HelperClient.swift`: conform `HelperClient` to a protocol.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/HelperClientProtocol.swift`: client protocol.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`: UI state and actions.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionRootView.swift`: root SwiftUI flow.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/ConnectionSetupView.swift`: helper URL, pairing code, device name form.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/PendingRequestsView.swift`: pending request list.
- Create `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`: ViewModel behavior tests.
- Modify `README.md`: document the SwiftUI UI target status.

## Task 1: Client Protocol

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Package.swift`
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/HelperClientProtocol.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/HelperClient.swift`

- [ ] **Step 1: Add protocol and package target declarations**

Modify `Package.swift` so products and targets include `AgentsInWatchMobileUI`:

```swift
products: [
    .library(
        name: "AgentsInWatchCore",
        targets: ["AgentsInWatchCore"]
    ),
    .library(
        name: "AgentsInWatchMobileUI",
        targets: ["AgentsInWatchMobileUI"]
    )
],
targets: [
    .target(name: "AgentsInWatchCore"),
    .target(
        name: "AgentsInWatchMobileUI",
        dependencies: ["AgentsInWatchCore"]
    ),
    .testTarget(
        name: "AgentsInWatchCoreTests",
        dependencies: ["AgentsInWatchCore"]
    ),
    .testTarget(
        name: "AgentsInWatchMobileUITests",
        dependencies: ["AgentsInWatchMobileUI"]
    )
]
```

Create `HelperClientProtocol.swift`:

```swift
import Foundation

public protocol HelperClientProtocol: Sendable {
    var bearerToken: String? { get set }

    func claimPairing(code: String, deviceName: String) async throws -> PairingClaim
    func refreshClaim(id: String) async throws -> PairingClaim
    func listPendingRequests() async throws -> [AgentRequest]
    func respond(to requestId: String, response: RequestResponse) async throws -> AgentRequest
}
```

Modify the class declaration in `HelperClient.swift`:

```swift
public final class HelperClient: HelperClientProtocol, @unchecked Sendable {
```

- [ ] **Step 2: Run Swift tests**

Run: `swift test` from `mobile/ios/AgentsInWatchCore`.

Expected: FAIL because the new `AgentsInWatchMobileUI` target has no source files yet.

## Task 2: ViewModel

**Files:**
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`
- Create: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`

- [ ] **Step 1: Write failing ViewModel tests**

Create `CompanionViewModelTests.swift`:

```swift
import Foundation
import Testing
import AgentsInWatchCore
@testable import AgentsInWatchMobileUI

@MainActor
struct CompanionViewModelTests {
    @Test func startsDisconnected() {
        let model = CompanionViewModel(clientFactory: { _ in FakeClient() })

        #expect(model.phase == .disconnected)
        #expect(model.helperURLText == "http://127.0.0.1:42731")
        #expect(model.deviceName.isEmpty == false)
    }

    @Test func claimsPairingAndMovesToAwaitingApproval() async {
        let client = FakeClient()
        client.claimToReturn = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .pendingApproval,
            token: nil
        )
        let model = CompanionViewModel(clientFactory: { _ in client })
        model.pairingCode = "123456"
        model.deviceName = "Quinn iPhone"

        await model.claimPairing()

        #expect(model.phase == .awaitingApproval(claimId: "claim-1"))
        #expect(model.errorMessage == nil)
    }

    @Test func refreshesApprovedClaimAndLoadsPendingRequests() async {
        let client = FakeClient()
        client.claimToReturn = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .pendingApproval,
            token: nil
        )
        client.refreshedClaimToReturn = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .approved,
            token: "approved-token"
        )
        client.requestsToReturn = [sampleRequest(id: "request-1")]
        let model = CompanionViewModel(clientFactory: { _ in client })
        model.pairingCode = "123456"

        await model.claimPairing()
        await model.refreshPairingStatus()

        #expect(model.phase == .connected)
        #expect(model.pendingRequests.map(\.id) == ["request-1"])
    }

    @Test func sendsAllowResponseAndReloadsRequests() async {
        let client = FakeClient()
        client.requestsToReturn = [sampleRequest(id: "request-1")]
        let model = CompanionViewModel(clientFactory: { _ in client })
        model.attachApprovedClientForTesting(client)

        await model.loadPendingRequests()
        await model.respond(to: model.pendingRequests[0], action: .allow)

        #expect(client.responsesSent == [("request-1", .allow)])
    }
}

private final class FakeClient: HelperClientProtocol, @unchecked Sendable {
    var bearerToken: String?
    var claimToReturn: PairingClaim?
    var refreshedClaimToReturn: PairingClaim?
    var requestsToReturn: [AgentRequest] = []
    var responsesSent: [(String, RequestAction)] = []

    func claimPairing(code: String, deviceName: String) async throws -> PairingClaim {
        claimToReturn!
    }

    func refreshClaim(id: String) async throws -> PairingClaim {
        refreshedClaimToReturn!
    }

    func listPendingRequests() async throws -> [AgentRequest] {
        requestsToReturn
    }

    func respond(to requestId: String, response: RequestResponse) async throws -> AgentRequest {
        responsesSent.append((requestId, response.action))
        return sampleRequest(id: requestId)
    }
}

private func sampleRequest(id: String) -> AgentRequest {
    AgentRequest(
        id: id,
        agentType: .claudeCode,
        projectName: "payments-api",
        computerName: "work-mac",
        sessionId: "session-1",
        requestType: .approval,
        title: "Allow command",
        watchSummary: "Claude wants to run pnpm test",
        phoneContext: "Command: pnpm test",
        actions: [.allow, .deny, .pause],
        riskLevel: .low,
        status: .pending,
        createdAt: Date(timeIntervalSince1970: 0),
        expiresAt: nil
    )
}
```

- [ ] **Step 2: Run UI tests and confirm failure**

Run: `swift test --filter CompanionViewModelTests`.

Expected: FAIL because `CompanionViewModel` does not exist.

- [ ] **Step 3: Implement ViewModel**

Create `CompanionViewModel.swift`:

```swift
import Foundation
import AgentsInWatchCore

@MainActor
public final class CompanionViewModel: ObservableObject {
    public enum Phase: Equatable {
        case disconnected
        case awaitingApproval(claimId: String)
        case connected
    }

    @Published public var helperURLText: String
    @Published public var pairingCode: String
    @Published public var deviceName: String
    @Published public private(set) var phase: Phase
    @Published public private(set) var pendingRequests: [AgentRequest]
    @Published public private(set) var isLoading: Bool
    @Published public private(set) var errorMessage: String?

    private let clientFactory: @Sendable (URL) -> HelperClientProtocol
    private var client: HelperClientProtocol?

    public init(
        helperURLText: String = "http://127.0.0.1:42731",
        deviceName: String = Host.current().localizedName ?? "iPhone",
        clientFactory: @escaping @Sendable (URL) -> HelperClientProtocol = { HelperClient(baseURL: $0) }
    ) {
        self.helperURLText = helperURLText
        self.pairingCode = ""
        self.deviceName = deviceName
        self.phase = .disconnected
        self.pendingRequests = []
        self.isLoading = false
        self.errorMessage = nil
        self.clientFactory = clientFactory
    }

    public func claimPairing() async {
        await runLoading {
            let client = try makeClient()
            let claim = try await client.claimPairing(
                code: pairingCode.trimmingCharacters(in: .whitespacesAndNewlines),
                deviceName: deviceName.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            self.client = client
            if claim.status == .approved {
                phase = .connected
                await loadPendingRequests()
            } else {
                phase = .awaitingApproval(claimId: claim.id)
            }
        }
    }

    public func refreshPairingStatus() async {
        guard case let .awaitingApproval(claimId) = phase, let client else {
            return
        }

        await runLoading {
            let claim = try await client.refreshClaim(id: claimId)
            if claim.status == .approved {
                phase = .connected
                await loadPendingRequests()
            }
        }
    }

    public func loadPendingRequests() async {
        guard let client else {
            return
        }

        await runLoading {
            pendingRequests = try await client.listPendingRequests()
        }
    }

    public func respond(to request: AgentRequest, action: RequestAction) async {
        guard let client else {
            return
        }

        await runLoading {
            _ = try await client.respond(
                to: request.id,
                response: RequestResponse(action: action)
            )
            pendingRequests = try await client.listPendingRequests()
        }
    }

    public func attachApprovedClientForTesting(_ client: HelperClientProtocol) {
        self.client = client
        self.phase = .connected
    }

    private func makeClient() throws -> HelperClientProtocol {
        guard let url = URL(string: helperURLText), url.scheme != nil, url.host != nil else {
            throw CompanionViewModelError.invalidHelperURL
        }
        return clientFactory(url)
    }

    private func runLoading(_ operation: () async throws -> Void) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            try await operation()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

public enum CompanionViewModelError: LocalizedError {
    case invalidHelperURL

    public var errorDescription: String? {
        switch self {
        case .invalidHelperURL:
            "Enter a valid helper URL."
        }
    }
}
```

- [ ] **Step 4: Run UI tests and confirm pass**

Run: `swift test --filter CompanionViewModelTests`.

Expected: PASS, 4 tests.

## Task 3: SwiftUI Views

**Files:**
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionRootView.swift`
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/ConnectionSetupView.swift`
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/PendingRequestsView.swift`

- [ ] **Step 1: Implement root and child views**

Create `CompanionRootView.swift`:

```swift
import SwiftUI
import AgentsInWatchCore

public struct CompanionRootView: View {
    @StateObject private var model: CompanionViewModel

    public init(model: CompanionViewModel = CompanionViewModel()) {
        _model = StateObject(wrappedValue: model)
    }

    public var body: some View {
        NavigationStack {
            Group {
                switch model.phase {
                case .disconnected, .awaitingApproval:
                    ConnectionSetupView(model: model)
                case .connected:
                    PendingRequestsView(model: model)
                }
            }
            .navigationTitle("Agents in Watch")
            .toolbar {
                if model.isLoading {
                    ProgressView()
                }
            }
        }
    }
}
```

Create `ConnectionSetupView.swift`:

```swift
import SwiftUI

public struct ConnectionSetupView: View {
    @ObservedObject var model: CompanionViewModel

    public init(model: CompanionViewModel) {
        self.model = model
    }

    public var body: some View {
        Form {
            Section("Desktop Helper") {
                TextField("Helper URL", text: $model.helperURLText)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                TextField("Device name", text: $model.deviceName)
                TextField("Pairing code", text: $model.pairingCode)
                    .keyboardType(.numberPad)
            }

            Section {
                Button {
                    Task { await model.claimPairing() }
                } label: {
                    Label("Pair with Desktop", systemImage: "link")
                }
                .disabled(model.isLoading || model.pairingCode.isEmpty)

                if case .awaitingApproval = model.phase {
                    Button {
                        Task { await model.refreshPairingStatus() }
                    } label: {
                        Label("Check Approval", systemImage: "arrow.clockwise")
                    }
                }
            }

            if let errorMessage = model.errorMessage {
                Section {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                }
            }
        }
    }
}
```

Create `PendingRequestsView.swift`:

```swift
import SwiftUI
import AgentsInWatchCore

public struct PendingRequestsView: View {
    @ObservedObject var model: CompanionViewModel

    public init(model: CompanionViewModel) {
        self.model = model
    }

    public var body: some View {
        List {
            if model.pendingRequests.isEmpty {
                ContentUnavailableView(
                    "No Pending Requests",
                    systemImage: "checkmark.circle",
                    description: Text("Agent approvals will appear here when your desktop helper receives them.")
                )
            } else {
                ForEach(model.pendingRequests) { request in
                    RequestCard(request: request) { action in
                        Task { await model.respond(to: request, action: action) }
                    }
                }
            }
        }
        .refreshable {
            await model.loadPendingRequests()
        }
        .task {
            await model.loadPendingRequests()
        }
    }
}

private struct RequestCard: View {
    let request: AgentRequest
    let onAction: (RequestAction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            VStack(alignment: .leading, spacing: 4) {
                Text(request.title)
                    .font(.headline)
                Text(request.watchSummary)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                Text("\\(request.agentType.rawValue) · \\(request.projectName)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack {
                ForEach(request.actions, id: \.self) { action in
                    Button(actionLabel(for: action)) {
                        onAction(action)
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding(.vertical, 6)
    }

    private func actionLabel(for action: RequestAction) -> String {
        switch action {
        case .allow: "Allow"
        case .deny: "Deny"
        case .pause: "Pause"
        case .reply: "Reply"
        case .openPhone: "Open"
        }
    }
}
```

- [ ] **Step 2: Run Swift tests**

Run: `swift test`.

Expected: PASS for core and UI tests.

## Task 4: README and Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Replace the last sentence in `## iPhone Companion Core` with:

```md
The package currently contains tested models, a helper API client, and a minimal SwiftUI companion interface. It does not yet include a standalone Xcode app target, QR scanning, Keychain token storage, or WatchConnectivity.
```

- [ ] **Step 2: Run Node tests**

Run: `npm test` from repo root.

Expected: PASS, 19 tests.

- [ ] **Step 3: Run Swift tests**

Run: `swift test` from `mobile/ios/AgentsInWatchCore`.

Expected: PASS, 8 tests total.

- [ ] **Step 4: Commit**

```bash
git add README.md mobile/ios/AgentsInWatchCore
git commit -m "feat: add iPhone SwiftUI companion slice"
```

## Self-Review Notes

- Spec coverage: this plan adds the first user-visible iPhone companion flow for pairing and pending request review.
- Placeholder scan: no TODO/TBD placeholders; app target, QR, Keychain, and WatchConnectivity are explicitly out of scope.
- Design stance: the UI is intentionally quiet and utilitarian, matching a developer tool rather than a marketing page.
