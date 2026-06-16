import AgentsInWatchCore
import Combine
import Foundation

@MainActor
public final class WatchRequestsViewModel: ObservableObject {
    @Published public private(set) var requests: [AgentRequest]
    @Published public private(set) var errorMessage: String?
    @Published public private(set) var responseStatus: WatchResponseBridgeStatus

    private let responseBridge: any WatchResponseBridge

    public init(
        requests: [AgentRequest] = [],
        responseBridge: any WatchResponseBridge = DefaultWatchResponseBridgeFactory.make()
    ) {
        self.requests = requests
        self.errorMessage = nil
        self.responseBridge = responseBridge
        self.responseStatus = responseBridge.status

        responseBridge.setStatusHandler { [weak self] status in
            Task { @MainActor [weak self] in
                self?.responseStatus = status
            }
        }
    }

    public func apply(applicationContext: [String: Any]) {
        do {
            requests = try WatchConnectivityPayload.decodeRequests(from: applicationContext)
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    public func send(action: RequestAction, for request: AgentRequest, message: String? = nil) {
        responseBridge.send(WatchRequestResponse(
            requestId: request.id,
            action: action,
            message: message
        ))
    }
}
