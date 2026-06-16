import Foundation
import Testing
@testable import AgentsInWatchCore

struct HelperClientTests {
    @Test func decodesPendingRequestList() throws {
        let json = """
        {
          "requests": [
            {
              "id": "request-1",
              "agentType": "claude-code",
              "projectName": "payments-api",
              "computerName": "work-mac",
              "sessionId": "session-1",
              "requestType": "approval",
              "title": "Allow command",
              "watchSummary": "Claude wants to run pnpm test",
              "phoneContext": "Command: pnpm test",
              "actions": ["allow", "deny", "pause"],
              "riskLevel": "low",
              "status": "pending",
              "createdAt": "2026-06-16T12:00:00.000Z",
              "expiresAt": null
            }
          ]
        }
        """.data(using: .utf8)!

        let list = try JSONDecoder.agentsInWatch.decode(PendingRequestsResponse.self, from: json)

        #expect(list.requests.count == 1)
        #expect(list.requests[0].id == "request-1")
        #expect(list.requests[0].agentType == AgentType.claudeCode)
        #expect(list.requests[0].actions == [RequestAction.allow, .deny, .pause])
    }
}
