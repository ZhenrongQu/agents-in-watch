import AgentsInWatchCore
import Foundation

#if canImport(UserNotifications)
import UserNotifications
#endif

public enum NotificationBridgeStatus: Equatable, Sendable {
    case unavailable
    case notDetermined
    case denied
    case ready

    public var title: String {
        switch self {
        case .unavailable:
            "Notifications Unavailable"
        case .notDetermined:
            "Notifications Need Permission"
        case .denied:
            "Notifications Off"
        case .ready:
            "Notifications Ready"
        }
    }

    public var detail: String {
        switch self {
        case .unavailable:
            "This environment cannot schedule local request alerts."
        case .notDetermined:
            "Allow notifications to get alerted when agents need attention."
        case .denied:
            "Enable notifications in Settings to receive request alerts."
        case .ready:
            "New agent requests can alert this iPhone and paired Watch."
        }
    }
}

public protocol NotificationBridge: Sendable {
    var status: NotificationBridgeStatus { get }
    func requestAuthorization() async
    func notifyNewRequest(_ request: AgentRequest) async
    func setStatusHandler(_ handler: @escaping @Sendable (NotificationBridgeStatus) -> Void)
}

public final class NoopNotificationBridge: NotificationBridge, @unchecked Sendable {
    public let status: NotificationBridgeStatus = .unavailable

    public init() {}

    public func requestAuthorization() async {}
    public func notifyNewRequest(_ request: AgentRequest) async {}
    public func setStatusHandler(_ handler: @escaping @Sendable (NotificationBridgeStatus) -> Void) {}
}

public enum DefaultNotificationBridgeFactory {
    public static func make() -> any NotificationBridge {
        #if os(iOS) && canImport(UserNotifications)
        UserNotificationBridge()
        #else
        NoopNotificationBridge()
        #endif
    }
}

#if os(iOS) && canImport(UserNotifications)
public final class UserNotificationBridge: NotificationBridge, @unchecked Sendable {
    private let center: UNUserNotificationCenter
    private var statusHandler: (@Sendable (NotificationBridgeStatus) -> Void)?

    public private(set) var status: NotificationBridgeStatus = .notDetermined

    public init(center: UNUserNotificationCenter = .current()) {
        self.center = center
        Task {
            await refreshStatus()
        }
    }

    public func requestAuthorization() async {
        do {
            _ = try await center.requestAuthorization(options: [.alert, .sound])
        } catch {
            updateStatus(.denied)
            return
        }
        await refreshStatus()
    }

    public func notifyNewRequest(_ request: AgentRequest) async {
        guard status == .ready else {
            return
        }
        let content = UNMutableNotificationContent()
        content.title = request.title
        content.body = request.watchSummary
        content.sound = .default

        let notificationRequest = UNNotificationRequest(
            identifier: "agents-in-watch-\(request.id)",
            content: content,
            trigger: nil
        )
        try? await center.add(notificationRequest)
    }

    public func setStatusHandler(_ handler: @escaping @Sendable (NotificationBridgeStatus) -> Void) {
        statusHandler = handler
    }

    private func refreshStatus() async {
        let settings = await center.notificationSettings()
        switch settings.authorizationStatus {
        case .authorized, .provisional, .ephemeral:
            updateStatus(.ready)
        case .denied:
            updateStatus(.denied)
        case .notDetermined:
            updateStatus(.notDetermined)
        @unknown default:
            updateStatus(.unavailable)
        }
    }

    private func updateStatus(_ nextStatus: NotificationBridgeStatus) {
        status = nextStatus
        statusHandler?(nextStatus)
    }
}
#endif
