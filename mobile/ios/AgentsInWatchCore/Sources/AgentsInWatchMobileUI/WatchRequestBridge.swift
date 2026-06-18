import AgentsInWatchCore
import Foundation
#if canImport(WatchConnectivity)
import WatchConnectivity
#endif

public struct WatchRequestBridgeStatus: Equatable, Sendable {
    public let title: String
    public let detail: String

    public init(title: String, detail: String) {
        self.title = title
        self.detail = detail
    }

    public static let unavailable = WatchRequestBridgeStatus(
        title: "Watch Unavailable",
        detail: "WatchConnectivity is not available on this device."
    )

    public static let activating = WatchRequestBridgeStatus(
        title: "Activating Watch",
        detail: "Waiting for the WatchConnectivity session."
    )

    public static let ready = WatchRequestBridgeStatus(
        title: "Watch Ready",
        detail: "Requests can be mirrored to Apple Watch."
    )
}

public protocol WatchRequestBridge: Sendable {
    var status: WatchRequestBridgeStatus { get }

    func publish(_ requests: [AgentRequest])
    func setResponseHandler(_ handler: @escaping @Sendable (WatchRequestResponse) -> Void)
    func setStatusHandler(_ handler: @escaping @Sendable (WatchRequestBridgeStatus) -> Void)
}

public struct NoopWatchRequestBridge: WatchRequestBridge {
    public init() {}

    public var status: WatchRequestBridgeStatus { .unavailable }

    public func publish(_ requests: [AgentRequest]) {}

    public func setResponseHandler(_ handler: @escaping @Sendable (WatchRequestResponse) -> Void) {}

    public func setStatusHandler(_ handler: @escaping @Sendable (WatchRequestBridgeStatus) -> Void) {}
}

public enum DefaultWatchRequestBridgeFactory {
    public static func make() -> any WatchRequestBridge {
        #if canImport(WatchConnectivity)
        WatchConnectivityRequestBridge()
        #else
        NoopWatchRequestBridge()
        #endif
    }
}

#if canImport(WatchConnectivity)
public final class WatchConnectivityRequestBridge: NSObject, WatchRequestBridge, WCSessionDelegate, @unchecked Sendable {
    private let session: WCSession?
    private var responseHandler: (@Sendable (WatchRequestResponse) -> Void)?
    private var statusHandler: (@Sendable (WatchRequestBridgeStatus) -> Void)?
    public private(set) var status: WatchRequestBridgeStatus

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

    public func publish(_ requests: [AgentRequest]) {
        guard let session else {
            return
        }
        guard let context = try? WatchConnectivityPayload.makeApplicationContext(requests: requests) else {
            return
        }
        try? session.updateApplicationContext(context)
    }

    public func setResponseHandler(_ handler: @escaping @Sendable (WatchRequestResponse) -> Void) {
        responseHandler = handler
    }

    public func setStatusHandler(_ handler: @escaping @Sendable (WatchRequestBridgeStatus) -> Void) {
        statusHandler = handler
    }

    public func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let response = try? WatchConnectivityPayload.decodeResponse(from: message) else {
            return
        }
        responseHandler?(response)
    }

    public func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {
        if let error {
            updateStatus(WatchRequestBridgeStatus(
                title: "Watch Error",
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
            updateStatus(WatchRequestBridgeStatus(
                title: "Watch Unknown",
                detail: "WatchConnectivity reported an unknown state."
            ))
        }
    }

    private func updateStatus(_ status: WatchRequestBridgeStatus) {
        self.status = status
        statusHandler?(status)
    }

    #if os(iOS)
    public func sessionDidBecomeInactive(_ session: WCSession) {}

    public func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
    #endif
}
#endif
