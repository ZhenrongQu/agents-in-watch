import AgentsInWatchCore
import Foundation
#if canImport(WatchConnectivity)
import WatchConnectivity
#endif

public struct WatchResponseBridgeStatus: Equatable, Sendable {
    public let title: String
    public let detail: String

    public init(title: String, detail: String) {
        self.title = title
        self.detail = detail
    }

    public static let unavailable = WatchResponseBridgeStatus(
        title: "iPhone Unavailable",
        detail: "WatchConnectivity is not available on this watch."
    )

    public static let activating = WatchResponseBridgeStatus(
        title: "Connecting to iPhone",
        detail: "Waiting for the WatchConnectivity session."
    )

    public static let ready = WatchResponseBridgeStatus(
        title: "iPhone Ready",
        detail: "Responses can be sent back to the iPhone."
    )
}

public protocol WatchResponseBridge: Sendable {
    var status: WatchResponseBridgeStatus { get }
    var currentRequests: [AgentRequest] { get }

    func send(_ response: WatchRequestResponse)
    func setStatusHandler(_ handler: @escaping @Sendable (WatchResponseBridgeStatus) -> Void)
    func setRequestsHandler(_ handler: @escaping @Sendable ([AgentRequest]) -> Void)
}

public struct NoopWatchResponseBridge: WatchResponseBridge {
    public init() {}

    public var status: WatchResponseBridgeStatus { .unavailable }
    public var currentRequests: [AgentRequest] { [] }

    public func send(_ response: WatchRequestResponse) {}

    public func setStatusHandler(_ handler: @escaping @Sendable (WatchResponseBridgeStatus) -> Void) {}

    public func setRequestsHandler(_ handler: @escaping @Sendable ([AgentRequest]) -> Void) {}
}

public enum DefaultWatchResponseBridgeFactory {
    public static func make() -> any WatchResponseBridge {
        #if canImport(WatchConnectivity)
        WatchConnectivityResponseBridge()
        #else
        NoopWatchResponseBridge()
        #endif
    }
}

#if canImport(WatchConnectivity)
public final class WatchConnectivityResponseBridge: NSObject, WatchResponseBridge, WCSessionDelegate, @unchecked Sendable {
    private let session: WCSession?
    private var statusHandler: (@Sendable (WatchResponseBridgeStatus) -> Void)?
    private var requestsHandler: (@Sendable ([AgentRequest]) -> Void)?
    public private(set) var status: WatchResponseBridgeStatus
    public var currentRequests: [AgentRequest] {
        guard let context = session?.receivedApplicationContext else {
            return []
        }
        return (try? WatchConnectivityPayload.decodeRequests(from: context)) ?? []
    }

    public override convenience init() {
        self.init(session: WCSession.isSupported() ? WCSession.default : nil)
    }

    init(session: WCSession?) {
        self.session = session
        self.status = session == nil ? .unavailable : .activating
        super.init()
        self.session?.delegate = self
        self.session?.activate()
    }

    public func send(_ response: WatchRequestResponse) {
        guard let session else {
            return
        }
        guard let message = try? WatchConnectivityPayload.makeMessage(response: response) else {
            return
        }
        session.sendMessage(message, replyHandler: nil, errorHandler: nil)
    }

    public func setStatusHandler(_ handler: @escaping @Sendable (WatchResponseBridgeStatus) -> Void) {
        statusHandler = handler
    }

    public func setRequestsHandler(_ handler: @escaping @Sendable ([AgentRequest]) -> Void) {
        requestsHandler = handler
    }

    public func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
        guard let requests = try? WatchConnectivityPayload.decodeRequests(from: applicationContext) else {
            return
        }
        requestsHandler?(requests)
    }

    public func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            updateStatus(WatchResponseBridgeStatus(
                title: "iPhone Error",
                detail: error.localizedDescription
            ))
            return
        }

        switch activationState {
        case .activated:
            updateStatus(.ready)
        case .inactive, .notActivated:
            updateStatus(.activating)
        @unknown default:
            updateStatus(WatchResponseBridgeStatus(
                title: "iPhone Unknown",
                detail: "WatchConnectivity reported an unknown state."
            ))
        }
    }

    private func updateStatus(_ status: WatchResponseBridgeStatus) {
        self.status = status
        statusHandler?(status)
    }
}
#endif
