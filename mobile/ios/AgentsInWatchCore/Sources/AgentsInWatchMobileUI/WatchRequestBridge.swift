import AgentsInWatchCore
import Foundation
#if canImport(WatchConnectivity)
import WatchConnectivity
#endif

public protocol WatchRequestBridge: Sendable {
    func publish(_ requests: [AgentRequest])
}

public struct NoopWatchRequestBridge: WatchRequestBridge {
    public init() {}

    public func publish(_ requests: [AgentRequest]) {}
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

    public override convenience init() {
        self.init(session: WCSession.isSupported() ? WCSession.default : nil)
    }

    init(session: WCSession?) {
        self.session = session
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

    public func session(
        _ session: WCSession,
        activationDidCompleteWith activationState: WCSessionActivationState,
        error: Error?
    ) {}

    #if os(iOS)
    public func sessionDidBecomeInactive(_ session: WCSession) {}

    public func sessionDidDeactivate(_ session: WCSession) {
        session.activate()
    }
    #endif
}
#endif
