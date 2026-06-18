import Foundation
import Testing
@testable import AgentsInWatchCore

struct AgentRequestActionsTests {
    @Test func userFacingActionsAddReplyWhenMissing() {
        let request = sampleRequest(actions: [.allow, .deny])

        #expect(request.userFacingActions == [.allow, .deny, .reply])
    }

    @Test func userFacingActionsDoNotDuplicateReply() {
        let request = sampleRequest(actions: [.allow, .reply, .deny])

        #expect(request.userFacingActions == [.allow, .reply, .deny])
    }
}

private func sampleRequest(actions: [RequestAction]) -> AgentRequest {
    AgentRequest(
        id: "request-1",
        agentType: .claudeCode,
        projectName: "payments-api",
        computerName: "work-mac",
        sessionId: "session-1",
        requestType: .approval,
        title: "Allow command",
        watchSummary: "Claude wants to run pnpm test",
        phoneContext: "Command: pnpm test",
        actions: actions,
        riskLevel: .low,
        status: .pending,
        createdAt: Date(timeIntervalSince1970: 1_781_092_800),
        expiresAt: nil
    )
}
