import Foundation

public struct PendingRequestsResponse: Codable, Equatable, Sendable {
    public let requests: [AgentRequest]

    public init(requests: [AgentRequest]) {
        self.requests = requests
    }
}

public struct AgentRequest: Codable, Equatable, Identifiable, Sendable {
    public let id: String
    public let agentType: AgentType
    public let projectName: String
    public let computerName: String
    public let sessionId: String
    public let requestType: RequestType
    public let title: String
    public let watchSummary: String
    public let phoneContext: String
    public let actions: [RequestAction]
    public let riskLevel: RiskLevel
    public let status: RequestStatus
    public let createdAt: Date
    public let expiresAt: Date?

    public init(
        id: String,
        agentType: AgentType,
        projectName: String,
        computerName: String,
        sessionId: String,
        requestType: RequestType,
        title: String,
        watchSummary: String,
        phoneContext: String,
        actions: [RequestAction],
        riskLevel: RiskLevel,
        status: RequestStatus,
        createdAt: Date,
        expiresAt: Date?
    ) {
        self.id = id
        self.agentType = agentType
        self.projectName = projectName
        self.computerName = computerName
        self.sessionId = sessionId
        self.requestType = requestType
        self.title = title
        self.watchSummary = watchSummary
        self.phoneContext = phoneContext
        self.actions = actions
        self.riskLevel = riskLevel
        self.status = status
        self.createdAt = createdAt
        self.expiresAt = expiresAt
    }
}

public enum AgentType: String, Codable, Equatable, Sendable {
    case claudeCode = "claude-code"
    case codexDesktop = "codex-desktop"
}

public enum RequestType: String, Codable, Equatable, Sendable {
    case approval
    case shortReply = "short-reply"
    case pause
    case notification
}

public enum RequestAction: String, Codable, Equatable, Hashable, Sendable {
    case allow
    case deny
    case pause
    case reply
    case openPhone = "open-phone"
}

public enum RiskLevel: String, Codable, Equatable, Sendable {
    case low
    case medium
    case high
}

public enum RequestStatus: String, Codable, Equatable, Sendable {
    case pending
    case resolved
}

public struct PairingClaim: Decodable, Equatable, Sendable {
    public let id: String
    public let pairingSessionId: String
    public let deviceName: String
    public let status: PairingClaimStatus
    public let token: String?

    public init(
        id: String,
        pairingSessionId: String,
        deviceName: String,
        status: PairingClaimStatus,
        token: String?
    ) {
        self.id = id
        self.pairingSessionId = pairingSessionId
        self.deviceName = deviceName
        self.status = status
        self.token = token
    }
}

public enum PairingClaimStatus: String, Decodable, Equatable, Sendable {
    case pendingApproval = "pending-approval"
    case approved
}

public struct RequestResponse: Encodable, Equatable, Sendable {
    public let action: RequestAction
    public let message: String?

    public init(action: RequestAction, message: String? = nil) {
        self.action = action
        self.message = message
    }
}

public extension JSONDecoder {
    static var agentsInWatch: JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601WithFractionalSeconds
        return decoder
    }
}

public extension JSONEncoder {
    static var agentsInWatch: JSONEncoder {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601WithFractionalSeconds
        return encoder
    }
}

private extension JSONDecoder.DateDecodingStrategy {
    static let iso8601WithFractionalSeconds = custom { decoder in
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        if let date = makeISO8601DateFormatter().date(from: value) {
            return date
        }
        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Invalid ISO8601 date: \(value)"
        )
    }
}

private extension JSONEncoder.DateEncodingStrategy {
    static let iso8601WithFractionalSeconds = custom { date, encoder in
        var container = encoder.singleValueContainer()
        try container.encode(makeISO8601DateFormatter().string(from: date))
    }
}

private func makeISO8601DateFormatter() -> ISO8601DateFormatter {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
}
