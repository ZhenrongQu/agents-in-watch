import AgentsInWatchCore
import Combine
import Foundation

@MainActor
public final class WatchRequestsViewModel: ObservableObject {
    @Published public private(set) var requests: [AgentRequest]
    @Published public private(set) var errorMessage: String?

    public init(requests: [AgentRequest] = []) {
        self.requests = requests
        self.errorMessage = nil
    }

    public func apply(applicationContext: [String: Any]) {
        do {
            requests = try WatchConnectivityPayload.decodeRequests(from: applicationContext)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}
