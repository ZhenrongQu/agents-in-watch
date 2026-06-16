import Foundation

public enum WatchConnectivityPayload {
    public static let pendingRequestsKey = "pendingRequestsJSON"

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
}
