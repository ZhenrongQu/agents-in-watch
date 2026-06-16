import Foundation

public struct AutoRefreshStatus: Equatable, Sendable {
    public let isRunning: Bool
    public let lastRefreshedAt: Date?

    public static let stopped = AutoRefreshStatus(isRunning: false, lastRefreshedAt: nil)

    public var title: String {
        isRunning ? "Auto Refresh On" : "Auto Refresh Off"
    }

    public var detail: String {
        guard isRunning else {
            return "Open and connect the companion to poll for new agent requests."
        }
        guard let lastRefreshedAt else {
            return "Checking for new requests while this app is open."
        }
        return "Last checked at \(lastRefreshedAt.formatted(date: .omitted, time: .shortened))."
    }
}

public protocol AutoRefreshDriver: Sendable {
    var isRunning: Bool { get }
    func setTickHandler(_ handler: @escaping @Sendable () -> Void)
    func start()
    func stop()
}

public final class NoopAutoRefreshDriver: AutoRefreshDriver, @unchecked Sendable {
    public let isRunning = false

    public init() {}

    public func setTickHandler(_ handler: @escaping @Sendable () -> Void) {}
    public func start() {}
    public func stop() {}
}

public final class TaskAutoRefreshDriver: AutoRefreshDriver, @unchecked Sendable {
    private let intervalNanoseconds: UInt64
    private var task: Task<Void, Never>?
    private var tickHandler: (@Sendable () -> Void)?

    public var isRunning: Bool {
        task != nil
    }

    public init(intervalSeconds: UInt64 = 15) {
        self.intervalNanoseconds = intervalSeconds * 1_000_000_000
    }

    deinit {
        stop()
    }

    public func setTickHandler(_ handler: @escaping @Sendable () -> Void) {
        tickHandler = handler
    }

    public func start() {
        guard task == nil else {
            return
        }
        task = Task { [intervalNanoseconds] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: intervalNanoseconds)
                guard !Task.isCancelled else {
                    return
                }
                tickHandler?()
            }
        }
    }

    public func stop() {
        task?.cancel()
        task = nil
    }
}
