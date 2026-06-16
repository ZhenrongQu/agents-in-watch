import AgentsInWatchCore
import Foundation
import Testing
@testable import AgentsInWatchWatchUI

@MainActor
struct WatchRequestsViewModelTests {
    @Test func startsEmpty() {
        let bridge = FakeWatchResponseBridge(status: .unavailable)
        let model = WatchRequestsViewModel(responseBridge: bridge)

        #expect(model.requests.isEmpty)
        #expect(model.errorMessage == nil)
        #expect(model.responseStatus == .unavailable)
    }

    @Test func appliesApplicationContext() throws {
        let request = sampleRequest(id: "request-1")
        let context = try WatchConnectivityPayload.makeApplicationContext(requests: [request])
        let model = WatchRequestsViewModel()

        model.apply(applicationContext: context)

        #expect(model.requests == [request])
        #expect(model.errorMessage == nil)
    }

    @Test func sendsWatchResponseForRequestAction() throws {
        let request = sampleRequest(id: "request-1")
        let bridge = FakeWatchResponseBridge()
        let model = WatchRequestsViewModel(requests: [request], responseBridge: bridge)

        model.send(action: .allow, for: request)

        #expect(bridge.sentResponses == [
            WatchRequestResponse(requestId: "request-1", action: .allow)
        ])
    }

    @Test func sendsWatchReplyWithMessage() throws {
        let request = sampleRequest(id: "request-1")
        let bridge = FakeWatchResponseBridge()
        let model = WatchRequestsViewModel(requests: [request], responseBridge: bridge)

        model.send(action: .reply, for: request, message: "try the focused test")

        #expect(bridge.sentResponses == [
            WatchRequestResponse(
                requestId: "request-1",
                action: .reply,
                message: "try the focused test"
            )
        ])
    }

    @Test func updatesResponseStatusFromBridge() async {
        let bridge = FakeWatchResponseBridge(status: .activating)
        let model = WatchRequestsViewModel(responseBridge: bridge)

        bridge.simulateStatus(.ready)
        for _ in 0..<5 {
            await Task.yield()
        }

        #expect(model.responseStatus == .ready)
    }
}

private final class FakeWatchResponseBridge: WatchResponseBridge, @unchecked Sendable {
    var sentResponses: [WatchRequestResponse] = []
    private(set) var status: WatchResponseBridgeStatus
    private var statusHandler: (@Sendable (WatchResponseBridgeStatus) -> Void)?

    init(status: WatchResponseBridgeStatus = .ready) {
        self.status = status
    }

    func send(_ response: WatchRequestResponse) {
        sentResponses.append(response)
    }

    func setStatusHandler(_ handler: @escaping @Sendable (WatchResponseBridgeStatus) -> Void) {
        statusHandler = handler
    }

    func simulateStatus(_ status: WatchResponseBridgeStatus) {
        self.status = status
        statusHandler?(status)
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
