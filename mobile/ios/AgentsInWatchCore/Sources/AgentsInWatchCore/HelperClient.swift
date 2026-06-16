import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public final class HelperClient: HelperClientProtocol, @unchecked Sendable {
    public let baseURL: URL
    public var bearerToken: String?

    private let transport: HTTPTransport
    private let decoder = JSONDecoder.agentsInWatch
    private let encoder = JSONEncoder.agentsInWatch

    public init(baseURL: URL, transport: HTTPTransport = URLSessionHTTPTransport()) {
        self.baseURL = baseURL
        self.transport = transport
    }

    public func claimPairing(code: String, deviceName: String) async throws -> PairingClaim {
        let body = ["code": code, "deviceName": deviceName]
        let claim: PairingClaim = try await send(
            path: "/pairing/claims",
            method: "POST",
            body: body,
            requiresAuth: false
        )
        storeTokenIfApproved(claim)
        return claim
    }

    public func refreshClaim(id: String) async throws -> PairingClaim {
        let claim: PairingClaim = try await send(
            path: "/pairing/claims/\(id)",
            method: "GET",
            body: Optional<String>.none,
            requiresAuth: false
        )
        storeTokenIfApproved(claim)
        return claim
    }

    public func listPendingRequests() async throws -> [AgentRequest] {
        let response: PendingRequestsResponse = try await send(
            path: "/requests",
            method: "GET",
            body: Optional<String>.none,
            requiresAuth: true
        )
        return response.requests
    }

    public func respond(to requestId: String, response: RequestResponse) async throws -> AgentRequest {
        try await send(
            path: "/requests/\(requestId)/response",
            method: "POST",
            body: response,
            requiresAuth: true
        )
    }

    private func send<Response: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body?,
        requiresAuth: Bool
    ) async throws -> Response {
        var request = URLRequest(url: url(for: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "accept")

        if requiresAuth {
            guard let bearerToken else {
                throw HelperClientError.missingBearerToken
            }
            request.setValue("Bearer \(bearerToken)", forHTTPHeaderField: "authorization")
        }

        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "content-type")
        }

        let (data, response) = try await transport.data(for: request)
        guard (200..<300).contains(response.statusCode) else {
            throw HelperClientError.httpStatus(response.statusCode)
        }

        return try decoder.decode(Response.self, from: data)
    }

    private func storeTokenIfApproved(_ claim: PairingClaim) {
        if claim.status == .approved, let token = claim.token {
            bearerToken = token
        }
    }

    private func url(for path: String) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let nextPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let joinedPath = [basePath, nextPath].filter { !$0.isEmpty }.joined(separator: "/")
        components.path = "/" + joinedPath
        return components.url!
    }
}

public enum HelperClientError: Error, Equatable {
    case missingBearerToken
    case invalidHTTPResponse
    case httpStatus(Int)
}
