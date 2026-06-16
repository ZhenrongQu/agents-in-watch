import AgentsInWatchCore
import Foundation
import Testing
@testable import AgentsInWatchMobileUI

@MainActor
struct CompanionViewModelTests {
    @Test func startsDisconnected() {
        let model = CompanionViewModel(credentialStore: InMemoryPairingCredentialStore())

        #expect(model.phase == .disconnected)
        #expect(model.pendingRequests.isEmpty)
        #expect(model.isLoading == false)
        #expect(model.errorMessage == nil)
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

    func publish(_ requests: [AgentRequest]) {
        publishedRequests.append(requests)
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
