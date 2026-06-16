import Foundation
import Testing
@testable import AgentsInWatchCore

struct WatchConnectivityPayloadTests {
    @Test func encodesAndDecodesPendingRequestsApplicationContext() throws {
        let request = sampleRequest(id: "request-1")

        let context = try WatchConnectivityPayload.makeApplicationContext(requests: [request])
        let decoded = try WatchConnectivityPayload.decodeRequests(from: context)

        #expect(decoded == [request])
    }

    @Test func decodesEmptyRequestsWhenPayloadIsMissing() throws {
        let decoded = try WatchConnectivityPayload.decodeRequests(from: [:])

        #expect(decoded.isEmpty)
    }

    @Test func encodesAndDecodesWatchResponseMessage() throws {
        let response = WatchRequestResponse(
            requestId: "request-1",
            action: .reply,
            message: "run the focused test"
        )

        let message = try WatchConnectivityPayload.makeMessage(response: response)
        let decoded = try WatchConnectivityPayload.decodeResponse(from: message)

        #expect(decoded == response)
    }

    @Test func encodesAndDecodesWatchApprovalWithoutMessage() throws {
        let response = WatchRequestResponse(
            requestId: "request-1",
            action: .allow,
            message: nil
        )

        let message = try WatchConnectivityPayload.makeMessage(response: response)
        let decoded = try WatchConnectivityPayload.decodeResponse(from: message)

        #expect(decoded == response)
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
