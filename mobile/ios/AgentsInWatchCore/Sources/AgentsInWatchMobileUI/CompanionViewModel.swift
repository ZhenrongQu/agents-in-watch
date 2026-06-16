import AgentsInWatchCore
import Combine
import Foundation

@MainActor
public final class CompanionViewModel: ObservableObject {
    public enum Phase: Equatable {
        case disconnected
        case awaitingApproval(claimId: String)
        case connected
    }

    @Published public var helperURLText: String
    @Published public var pairingCode: String
    @Published public var deviceName: String
    @Published public private(set) var phase: Phase
    @Published public private(set) var pendingRequests: [AgentRequest]
    @Published public private(set) var isLoading: Bool
    @Published public private(set) var errorMessage: String?

    private let clientFactory: @Sendable (URL) -> any HelperClientProtocol
    private var client: (any HelperClientProtocol)?

    public init(
        helperURLText: String = "http://127.0.0.1:42731",
        pairingCode: String = "",
        deviceName: String = "iPhone",
        clientFactory: @escaping @Sendable (URL) -> any HelperClientProtocol = { HelperClient(baseURL: $0) }
    ) {
        self.helperURLText = helperURLText
        self.pairingCode = pairingCode
        self.deviceName = deviceName
        self.clientFactory = clientFactory
        self.phase = .disconnected
        self.pendingRequests = []
        self.isLoading = false
        self.errorMessage = nil
    }

    public func claimPairing() async {
        await runLoading {
            guard let url = URL(string: helperURLText), url.scheme != nil, url.host != nil else {
                throw CompanionViewModelError.invalidHelperURL
            }

            let code = pairingCode.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !code.isEmpty else {
                throw CompanionViewModelError.missingPairingCode
            }

            let nextClient = clientFactory(url)
            let claim = try await nextClient.claimPairing(code: code, deviceName: deviceName)
            client = nextClient

            if claim.status == .approved, let token = claim.token {
                client?.bearerToken = token
                phase = .connected
                try await loadPendingRequestsFromClient()
            } else {
                phase = .awaitingApproval(claimId: claim.id)
            }
        }
    }

    public func refreshPairing() async {
        await runLoading {
            guard case .awaitingApproval(let claimId) = phase else {
                return
            }
            guard var activeClient = client else {
                throw CompanionViewModelError.notPaired
            }

            let claim = try await activeClient.refreshClaim(id: claimId)
            if claim.status == .approved, let token = claim.token {
                activeClient.bearerToken = token
                client = activeClient
                phase = .connected
                try await loadPendingRequestsFromClient()
            }
        }
    }

    public func loadPendingRequests() async {
        await runLoading {
            try await loadPendingRequestsFromClient()
        }
    }

    public func send(action: RequestAction, for request: AgentRequest, message: String? = nil) async {
        await runLoading {
            guard let activeClient = client else {
                throw CompanionViewModelError.notPaired
            }

            _ = try await activeClient.respond(
                to: request.id,
                response: RequestResponse(action: action, message: message)
            )
            try await loadPendingRequestsFromClient()
        }
    }

    public func disconnect() {
        client = nil
        phase = .disconnected
        pendingRequests = []
        errorMessage = nil
    }

    private func loadPendingRequestsFromClient() async throws {
        guard let activeClient = client else {
            throw CompanionViewModelError.notPaired
        }
        pendingRequests = try await activeClient.listPendingRequests()
    }

    private func runLoading(_ operation: () async throws -> Void) async {
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            try await operation()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

public enum CompanionViewModelError: LocalizedError, Equatable {
    case invalidHelperURL
    case missingPairingCode
    case notPaired

    public var errorDescription: String? {
        switch self {
        case .invalidHelperURL:
            "Enter a valid helper URL."
        case .missingPairingCode:
            "Enter the pairing code shown on your computer."
        case .notPaired:
            "Pair this iPhone with your helper before continuing."
        }
    }
}
