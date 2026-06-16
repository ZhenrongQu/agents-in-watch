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

    @Test func claimsPairingCodeAndStoresTokenAfterApproval() async throws {
        let transport = FakeTransport()
        transport.responses.append(jsonResponse("""
        {
          "id": "claim-1",
          "pairingSessionId": "session-1",
          "deviceName": "Quinn iPhone",
          "status": "pending-approval"
        }
        """))
        transport.responses.append(jsonResponse("""
        {
          "id": "claim-1",
          "pairingSessionId": "session-1",
          "deviceName": "Quinn iPhone",
          "status": "approved",
          "token": "approved-token"
        }
        """))
        let client = HelperClient(baseURL: URL(string: "http://127.0.0.1:42731")!, transport: transport)

        let claim = try await client.claimPairing(code: "123456", deviceName: "Quinn iPhone")
        #expect(claim.status == PairingClaimStatus.pendingApproval)

        let approved = try await client.refreshClaim(id: claim.id)
        #expect(approved.token == "approved-token")
        #expect(client.bearerToken == "approved-token")
    }

    @Test func listsPendingRequestsWithBearerToken() async throws {
        let transport = FakeTransport()
        transport.responses.append(jsonResponse("""
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
              "actions": ["allow", "deny"],
              "riskLevel": "low",
              "status": "pending",
              "createdAt": "2026-06-16T12:00:00.000Z",
              "expiresAt": null
            }
          ]
        }
        """))
        let client = HelperClient(baseURL: URL(string: "http://127.0.0.1:42731")!, transport: transport)
        client.bearerToken = "approved-token"

        let requests = try await client.listPendingRequests()

        #expect(requests.count == 1)
        #expect(transport.requests[0].value(forHTTPHeaderField: "authorization") == "Bearer approved-token")
    }

    @Test func sendsRequestResponseWithBearerToken() async throws {
        let transport = FakeTransport()
        transport.responses.append(jsonResponse("""
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
          "actions": ["allow", "deny"],
          "riskLevel": "low",
          "status": "resolved",
          "createdAt": "2026-06-16T12:00:00.000Z",
          "expiresAt": null
        }
        """))
        let client = HelperClient(baseURL: URL(string: "http://127.0.0.1:42731")!, transport: transport)
        client.bearerToken = "approved-token"

        _ = try await client.respond(to: "request-1", response: RequestResponse(action: .allow))

        #expect(transport.requests[0].url?.path == "/requests/request-1/response")
        #expect(transport.requests[0].httpMethod == "POST")
        #expect(transport.requests[0].value(forHTTPHeaderField: "authorization") == "Bearer approved-token")
    }
}

private final class FakeTransport: HTTPTransport, @unchecked Sendable {
    var requests: [URLRequest] = []
    var responses: [(Data, HTTPURLResponse)] = []

    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        return responses.removeFirst()
    }
}

private func jsonResponse(_ json: String, statusCode: Int = 200) -> (Data, HTTPURLResponse) {
    (
        json.data(using: .utf8)!,
        HTTPURLResponse(
            url: URL(string: "http://127.0.0.1:42731")!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["content-type": "application/json"]
        )!
    )
}
