import AgentsInWatchCore
import Foundation
#if canImport(WatchConnectivity)
import WatchConnectivity
#endif

public protocol WatchResponseBridge: Sendable {
    func send(_ response: WatchRequestResponse)
}

public struct NoopWatchResponseBridge: WatchResponseBridge {
    public init() {}

    public func send(_ response: WatchRequestResponse) {}
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

    public override convenience init() {
        self.init(session: WCSession.isSupported() ? WCSession.default : nil)
    }

    init(session: WCSession?) {
        self.session = session
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

    public func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}
}
#endif
