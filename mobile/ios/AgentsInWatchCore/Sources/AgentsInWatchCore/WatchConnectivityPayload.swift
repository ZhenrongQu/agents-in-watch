import Foundation

public struct WatchRequestResponse: Codable, Equatable, Sendable {
    public let requestId: String
    public let action: RequestAction
    public let message: String?

    public init(requestId: String, action: RequestAction, message: String? = nil) {
        self.requestId = requestId
        self.action = action
        self.message = message
    }
}

public enum WatchConnectivityPayload {
    public static let pendingRequestsKey = "pendingRequestsJSON"
    public static let requestResponseKey = "requestResponseJSON"

    public static func makeApplicationContext(requests: [AgentRequest]) throws -> [String: Any] {
        let data = try JSONEncoder.agentsInWatch.encode(PendingRequestsResponse(requests: requests))
        return [pendingRequestsKey: data]
    }

    public static func decodeRequests(from applicationContext: [String: Any]) throws -> [AgentRequest] {
        guard let data = applicationContext[pendingRequestsKey] as? Data else {
            return []
        }
        return try JSONDecoder.agentsInWatch.decode(PendingRequestsResponse.self, from: data).requests
    }

    public static func makeMessage(response: WatchRequestResponse) throws -> [String: Any] {
        let data = try JSONEncoder.agentsInWatch.encode(response)
        return [requestResponseKey: data]
    }

    public static func decodeResponse(from message: [String: Any]) throws -> WatchRequestResponse? {
        guard let data = message[requestResponseKey] as? Data else {
            return nil
        }
        return try JSONDecoder.agentsInWatch.decode(WatchRequestResponse.self, from: data)
    }
}
