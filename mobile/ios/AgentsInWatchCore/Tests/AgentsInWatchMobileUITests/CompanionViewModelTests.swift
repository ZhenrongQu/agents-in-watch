import AgentsInWatchCore
import Foundation
import Testing
@testable import AgentsInWatchMobileUI

@MainActor
struct CompanionViewModelTests {
    @Test func startsDisconnected() {
        let watchBridge = FakeWatchRequestBridge(status: .unavailable)
        let model = CompanionViewModel(
            credentialStore: InMemoryPairingCredentialStore(),
            watchBridge: watchBridge
        )

        #expect(model.phase == .disconnected)
        #expect(model.pendingRequests.isEmpty)
        #expect(model.isLoading == false)
        #expect(model.errorMessage == nil)
        #expect(model.watchStatus == .unavailable)
    }

    @Test func claimsPairingAndMovesToAwaitingApproval() async {
        let fakeClient = FakeClient()
        fakeClient.claimPairingResult = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .pendingApproval,
            token: nil
        )
        let model = CompanionViewModel(
            helperURLText: "http://127.0.0.1:42731",
            pairingCode: "123456",
            deviceName: "Quinn iPhone",
            credentialStore: InMemoryPairingCredentialStore(),
            clientFactory: { _ in fakeClient }
        )

        await model.claimPairing()

        #expect(fakeClient.claimedCode == "123456")
        #expect(fakeClient.claimedDeviceName == "Quinn iPhone")
        #expect(model.phase == .awaitingApproval(claimId: "claim-1"))
        #expect(model.errorMessage == nil)
    }

    @Test func refreshesApprovedClaimAndLoadsPendingRequests() async {
        let request = sampleRequest(id: "request-1")
        let fakeClient = FakeClient()
        fakeClient.claimPairingResult = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .pendingApproval,
            token: nil
        )
        fakeClient.refreshClaimResult = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .approved,
            token: "approved-token"
        )
        fakeClient.pendingRequestResults = [[request]]
        let model = CompanionViewModel(
            helperURLText: "http://127.0.0.1:42731",
            pairingCode: "123456",
            deviceName: "Quinn iPhone",
            credentialStore: InMemoryPairingCredentialStore(),
            clientFactory: { _ in fakeClient }
        )

        await model.claimPairing()
        await model.refreshPairing()

        #expect(fakeClient.refreshedClaimId == "claim-1")
        #expect(fakeClient.bearerToken == "approved-token")
        #expect(model.phase == .connected)
        #expect(model.pendingRequests == [request])
    }

    @Test func sendsAllowResponseAndReloadsRequests() async {
        let request = sampleRequest(id: "request-1")
        let fakeClient = FakeClient()
        let watchBridge = FakeWatchRequestBridge()
        fakeClient.claimPairingResult = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .pendingApproval,
            token: nil
        )
        fakeClient.refreshClaimResult = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .approved,
            token: "approved-token"
        )
        fakeClient.pendingRequestResults = [[request], []]
        let model = CompanionViewModel(
            helperURLText: "http://127.0.0.1:42731",
            pairingCode: "123456",
            deviceName: "Quinn iPhone",
            credentialStore: InMemoryPairingCredentialStore(),
            watchBridge: watchBridge,
            clientFactory: { _ in fakeClient }
        )

        await model.claimPairing()
        await model.refreshPairing()
        await model.send(action: .allow, for: request)

        #expect(fakeClient.respondedRequestId == "request-1")
        #expect(fakeClient.respondedResponse == RequestResponse(action: .allow))
        #expect(fakeClient.listPendingRequestsCallCount == 2)
        #expect(model.pendingRequests.isEmpty)
        #expect(watchBridge.publishedRequests == [[request], []])
    }

    @Test func routesWatchResponseToMatchingPendingRequest() async {
        let request = sampleRequest(id: "request-1")
        let fakeClient = FakeClient()
        let watchBridge = FakeWatchRequestBridge()
        fakeClient.claimPairingResult = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .pendingApproval,
            token: nil
        )
        fakeClient.refreshClaimResult = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .approved,
            token: "approved-token"
        )
        fakeClient.pendingRequestResults = [[request], []]
        let model = CompanionViewModel(
            helperURLText: "http://127.0.0.1:42731",
            pairingCode: "123456",
            deviceName: "Quinn iPhone",
            credentialStore: InMemoryPairingCredentialStore(),
            watchBridge: watchBridge,
            clientFactory: { _ in fakeClient }
        )

        await model.claimPairing()
        await model.refreshPairing()
        watchBridge.simulateResponse(WatchRequestResponse(
            requestId: "request-1",
            action: .deny,
            message: "not now"
        ))
        for _ in 0..<5 {
            await Task.yield()
        }

        #expect(fakeClient.respondedRequestId == "request-1")
        #expect(fakeClient.respondedResponse == RequestResponse(action: .deny, message: "not now"))
        #expect(model.pendingRequests.isEmpty)
    }

    @Test func startsConnectedWhenCredentialExists() async {
        let request = sampleRequest(id: "request-1")
        let watchBridge = FakeWatchRequestBridge()
        let store = InMemoryPairingCredentialStore(
            credential: StoredPairingCredential(
                helperURL: URL(string: "http://127.0.0.1:42731")!,
                bearerToken: "saved-token"
            )
        )
        let fakeClient = FakeClient()
        fakeClient.pendingRequestResults = [[request]]
        let model = CompanionViewModel(
            credentialStore: store,
            watchBridge: watchBridge,
            clientFactory: { _ in fakeClient }
        )

        await model.loadPendingRequests()

        #expect(model.phase == .connected)
        #expect(model.helperURLText == "http://127.0.0.1:42731")
        #expect(fakeClient.bearerToken == "saved-token")
        #expect(model.pendingRequests == [request])
        #expect(watchBridge.publishedRequests == [[request]])
    }

    @Test func savesApprovedCredentialAfterPairingApproval() async throws {
        let store = InMemoryPairingCredentialStore()
        let fakeClient = FakeClient()
        fakeClient.claimPairingResult = PairingClaim(
            id: "claim-1",
            pairingSessionId: "session-1",
            deviceName: "Quinn iPhone",
            status: .approved,
            token: "approved-token"
        )
        fakeClient.pendingRequestResults = [[]]
        let model = CompanionViewModel(
            helperURLText: "http://127.0.0.1:42731",
            pairingCode: "123456",
            deviceName: "Quinn iPhone",
            credentialStore: store,
            clientFactory: { _ in fakeClient }
        )

        await model.claimPairing()

        #expect(try store.load() == StoredPairingCredential(
            helperURL: URL(string: "http://127.0.0.1:42731")!,
            bearerToken: "approved-token"
        ))
    }

    @Test func clearsSavedCredentialOnDisconnect() async throws {
        let watchBridge = FakeWatchRequestBridge()
        let store = InMemoryPairingCredentialStore(
            credential: StoredPairingCredential(
                helperURL: URL(string: "http://127.0.0.1:42731")!,
                bearerToken: "saved-token"
            )
        )
        let model = CompanionViewModel(
            credentialStore: store,
            watchBridge: watchBridge,
            clientFactory: { _ in FakeClient() }
        )

        model.disconnect()

        #expect(try store.load() == nil)
        #expect(model.phase == .disconnected)
        #expect(watchBridge.publishedRequests == [[]])
    }

    @Test func updatesWatchStatusFromBridge() async {
        let watchBridge = FakeWatchRequestBridge(status: .activating)
        let model = CompanionViewModel(
            credentialStore: InMemoryPairingCredentialStore(),
            watchBridge: watchBridge
        )

        watchBridge.simulateStatus(.ready)
        for _ in 0..<5 {
            await Task.yield()
        }

        #expect(model.watchStatus == .ready)
    }

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
}

private final class FakeClient: HelperClientProtocol, @unchecked Sendable {
    var bearerToken: String?
    var claimPairingResult = PairingClaim(
        id: "claim-1",
        pairingSessionId: "session-1",
        deviceName: "iPhone",
        status: .pendingApproval,
        token: nil
    )
    var refreshClaimResult = PairingClaim(
        id: "claim-1",
        pairingSessionId: "session-1",
        deviceName: "iPhone",
        status: .pendingApproval,
        token: nil
    )
    var pendingRequestResults: [[AgentRequest]] = []
    var claimedCode: String?
    var claimedDeviceName: String?
    var refreshedClaimId: String?
    var respondedRequestId: String?
    var respondedResponse: RequestResponse?
    var listPendingRequestsCallCount = 0

    func claimPairing(code: String, deviceName: String) async throws -> PairingClaim {
        claimedCode = code
        claimedDeviceName = deviceName
        return claimPairingResult
    }

    func refreshClaim(id: String) async throws -> PairingClaim {
        refreshedClaimId = id
        return refreshClaimResult
    }

    func listPendingRequests() async throws -> [AgentRequest] {
        listPendingRequestsCallCount += 1
        if pendingRequestResults.isEmpty {
            return []
        }
        return pendingRequestResults.removeFirst()
    }

    func respond(to requestId: String, response: RequestResponse) async throws -> AgentRequest {
        respondedRequestId = requestId
        respondedResponse = response
        return sampleRequest(id: requestId)
    }
}

private final class FakeWatchRequestBridge: WatchRequestBridge, @unchecked Sendable {
    var publishedRequests: [[AgentRequest]] = []
    private(set) var status: WatchRequestBridgeStatus
    private var responseHandler: (@Sendable (WatchRequestResponse) -> Void)?
    private var statusHandler: (@Sendable (WatchRequestBridgeStatus) -> Void)?

    init(status: WatchRequestBridgeStatus = .ready) {
        self.status = status
    }

    func publish(_ requests: [AgentRequest]) {
        publishedRequests.append(requests)
    }

    func setResponseHandler(_ handler: @escaping @Sendable (WatchRequestResponse) -> Void) {
        responseHandler = handler
    }

    func simulateResponse(_ response: WatchRequestResponse) {
        responseHandler?(response)
    }

    func setStatusHandler(_ handler: @escaping @Sendable (WatchRequestBridgeStatus) -> Void) {
        statusHandler = handler
    }

    func simulateStatus(_ status: WatchRequestBridgeStatus) {
        self.status = status
        statusHandler?(status)
    }
}

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
        actions: [.allow, .deny],
        riskLevel: .low,
        status: .pending,
        createdAt: Date(timeIntervalSince1970: 1_781_092_800),
        expiresAt: nil
    )
}
