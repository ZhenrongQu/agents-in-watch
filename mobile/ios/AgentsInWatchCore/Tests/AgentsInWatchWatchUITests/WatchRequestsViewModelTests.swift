import AgentsInWatchCore
import Foundation
import Testing
@testable import AgentsInWatchWatchUI

@MainActor
struct WatchRequestsViewModelTests {
    @Test func startsEmpty() {
        let model = WatchRequestsViewModel()

        #expect(model.requests.isEmpty)
        #expect(model.errorMessage == nil)
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
}

private final class FakeWatchResponseBridge: WatchResponseBridge, @unchecked Sendable {
    var sentResponses: [WatchRequestResponse] = []

    func send(_ response: WatchRequestResponse) {
        sentResponses.append(response)
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
