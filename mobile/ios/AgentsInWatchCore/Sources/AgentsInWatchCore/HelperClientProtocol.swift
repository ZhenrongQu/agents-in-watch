import Foundation

public protocol HelperClientProtocol: Sendable {
    var bearerToken: String? { get set }

    func claimPairing(code: String, deviceName: String) async throws -> PairingClaim
    func refreshClaim(id: String) async throws -> PairingClaim
    func listPendingRequests() async throws -> [AgentRequest]
    func respond(to requestId: String, response: RequestResponse) async throws -> AgentRequest
}
