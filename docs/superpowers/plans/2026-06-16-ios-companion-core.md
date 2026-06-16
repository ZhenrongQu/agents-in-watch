# iOS Companion Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Swift core for the iPhone companion: pair with the Desktop Helper, store the approved bearer token in memory, list pending requests, and send request responses.

**Architecture:** Create a Swift Package under `mobile/ios/AgentsInWatchCore` with three small units: Codable API models, an injected HTTP transport, and `HelperClient` methods that map iPhone actions to Desktop Helper routes. Keep it UI-free so a SwiftUI iPhone app and Watch bridge can consume the same tested core later.

**Tech Stack:** Swift 6.1+, Swift Package Manager, XCTest, Foundation.

---

## Scope

This plan implements:

- Swift Codable models matching the Desktop Helper JSON.
- A testable `HTTPTransport` abstraction.
- `HelperClient` methods for pairing claim/status, pending request list, and response submission.
- In-memory token handling for the first mobile slice.
- README instructions for running Swift tests.

This plan does not implement SwiftUI screens, QR scanning, keychain storage, WatchConnectivity, push/local notifications, or an Xcode iOS app target.

## File Structure

- Create `mobile/ios/AgentsInWatchCore/Package.swift`: Swift package metadata.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/Models.swift`: Codable request, pairing, and response models.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/HTTPTransport.swift`: transport protocol and URLSession implementation.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/HelperClient.swift`: iPhone-facing API client.
- Create `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchCoreTests/HelperClientTests.swift`: client behavior tests with a fake transport.
- Modify `README.md`: document Swift core test command and current mobile status.

## Task 1: Swift Package Skeleton

**Files:**
- Create: `mobile/ios/AgentsInWatchCore/Package.swift`

- [ ] **Step 1: Create Swift package metadata**

Create `mobile/ios/AgentsInWatchCore/Package.swift`:

```swift
// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "AgentsInWatchCore",
    platforms: [
        .iOS(.v17),
        .watchOS(.v10),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "AgentsInWatchCore",
            targets: ["AgentsInWatchCore"]
        )
    ],
    targets: [
        .target(name: "AgentsInWatchCore"),
        .testTarget(
            name: "AgentsInWatchCoreTests",
            dependencies: ["AgentsInWatchCore"]
        )
    ]
)
```

- [ ] **Step 2: Run Swift tests and confirm baseline**

Run: `swift test` from `mobile/ios/AgentsInWatchCore`.

Expected: FAIL because the package has no source files yet.

## Task 2: API Models

**Files:**
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/Models.swift`
- Create: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchCoreTests/HelperClientTests.swift`

- [ ] **Step 1: Write failing model decode test**

Create `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchCoreTests/HelperClientTests.swift` with an initial decoding test:

```swift
import XCTest
@testable import AgentsInWatchCore

final class HelperClientTests: XCTestCase {
    func testDecodesPendingRequestList() throws {
        let json = """
        {
          "requests": [
            {
              "id": "request-1",
              "agentType": "claude-code",
              "projectName": "payments-api",
              "computerName": "work-mac",
              "sessionId": "session-1",
              "requestType": "approval",
              "title": "Allow command",
              "watchSummary": "Claude wants to run pnpm test",
              "phoneContext": "Command: pnpm test",
              "actions": ["allow", "deny", "pause"],
              "riskLevel": "low",
              "status": "pending",
              "createdAt": "2026-06-16T12:00:00.000Z",
              "expiresAt": null
            }
          ]
        }
        """.data(using: .utf8)!

        let list = try JSONDecoder.agentsInWatch.decode(PendingRequestsResponse.self, from: json)

        XCTAssertEqual(list.requests.count, 1)
        XCTAssertEqual(list.requests[0].id, "request-1")
        XCTAssertEqual(list.requests[0].agentType, .claudeCode)
        XCTAssertEqual(list.requests[0].actions, [.allow, .deny, .pause])
    }
}
```

- [ ] **Step 2: Run model test and confirm failure**

Run: `swift test --filter HelperClientTests/testDecodesPendingRequestList` from `mobile/ios/AgentsInWatchCore`.

Expected: FAIL because `PendingRequestsResponse` does not exist.

- [ ] **Step 3: Implement models**

Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/Models.swift`:

```swift
import Foundation

public struct PendingRequestsResponse: Decodable, Equatable, Sendable {
    public let requests: [AgentRequest]
}

public struct AgentRequest: Decodable, Equatable, Identifiable, Sendable {
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
}

public enum AgentType: String, Decodable, Equatable, Sendable {
    case claudeCode = "claude-code"
    case codexDesktop = "codex-desktop"
}

public enum RequestType: String, Decodable, Equatable, Sendable {
    case approval
    case shortReply = "short-reply"
    case pause
    case notification
}

public enum RequestAction: String, Codable, Equatable, Sendable {
    case allow
    case deny
    case pause
    case reply
    case openPhone = "open-phone"
}

public enum RiskLevel: String, Decodable, Equatable, Sendable {
    case low
    case medium
    case high
}

public enum RequestStatus: String, Decodable, Equatable, Sendable {
    case pending
    case resolved
}

public struct PairingClaim: Decodable, Equatable, Sendable {
    public let id: String
    public let pairingSessionId: String
    public let deviceName: String
    public let status: PairingClaimStatus
    public let token: String?
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
        if let date = ISO8601DateFormatter.agentsInWatch.date(from: value) {
            return date
        }
        throw DecodingError.dataCorruptedError(
            in: container,
            debugDescription: "Invalid ISO8601 date: \\(value)"
        )
    }
}

private extension JSONEncoder.DateEncodingStrategy {
    static let iso8601WithFractionalSeconds = custom { date, encoder in
        var container = encoder.singleValueContainer()
        try container.encode(ISO8601DateFormatter.agentsInWatch.string(from: date))
    }
}

private extension ISO8601DateFormatter {
    static let agentsInWatch: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
```

- [ ] **Step 4: Run model test and confirm pass**

Run: `swift test --filter HelperClientTests/testDecodesPendingRequestList`.

Expected: PASS.

## Task 3: Helper Client

**Files:**
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/HTTPTransport.swift`
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/HelperClient.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchCoreTests/HelperClientTests.swift`

- [ ] **Step 1: Add failing client tests**

Append these tests and fake transport to `HelperClientTests.swift`:

```swift
    func testClaimsPairingCodeAndStoresTokenAfterApproval() async throws {
        let transport = FakeTransport()
        transport.responses.append(jsonResponse("""
        {
          "id": "claim-1",
          "pairingSessionId": "session-1",
          "deviceName": "Quinn iPhone",
          "status": "pending-approval"
        }
        """))
        transport.responses.append(jsonResponse("""
        {
          "id": "claim-1",
          "pairingSessionId": "session-1",
          "deviceName": "Quinn iPhone",
          "status": "approved",
          "token": "approved-token"
        }
        """))
        let client = HelperClient(baseURL: URL(string: "http://127.0.0.1:42731")!, transport: transport)

        let claim = try await client.claimPairing(code: "123456", deviceName: "Quinn iPhone")
        XCTAssertEqual(claim.status, .pendingApproval)

        let approved = try await client.refreshClaim(id: claim.id)
        XCTAssertEqual(approved.token, "approved-token")
        XCTAssertEqual(client.bearerToken, "approved-token")
    }

    func testListsPendingRequestsWithBearerToken() async throws {
        let transport = FakeTransport()
        transport.responses.append(jsonResponse("""
        {
          "requests": [
            {
              "id": "request-1",
              "agentType": "claude-code",
              "projectName": "payments-api",
              "computerName": "work-mac",
              "sessionId": "session-1",
              "requestType": "approval",
              "title": "Allow command",
              "watchSummary": "Claude wants to run pnpm test",
              "phoneContext": "Command: pnpm test",
              "actions": ["allow", "deny"],
              "riskLevel": "low",
              "status": "pending",
              "createdAt": "2026-06-16T12:00:00.000Z",
              "expiresAt": null
            }
          ]
        }
        """))
        let client = HelperClient(baseURL: URL(string: "http://127.0.0.1:42731")!, transport: transport)
        client.bearerToken = "approved-token"

        let requests = try await client.listPendingRequests()

        XCTAssertEqual(requests.count, 1)
        XCTAssertEqual(transport.requests[0].value(forHTTPHeaderField: "authorization"), "Bearer approved-token")
    }

    func testSendsRequestResponseWithBearerToken() async throws {
        let transport = FakeTransport()
        transport.responses.append(jsonResponse("""
        {
          "id": "request-1",
          "agentType": "claude-code",
          "projectName": "payments-api",
          "computerName": "work-mac",
          "sessionId": "session-1",
          "requestType": "approval",
          "title": "Allow command",
          "watchSummary": "Claude wants to run pnpm test",
          "phoneContext": "Command: pnpm test",
          "actions": ["allow", "deny"],
          "riskLevel": "low",
          "status": "resolved",
          "createdAt": "2026-06-16T12:00:00.000Z",
          "expiresAt": null
        }
        """))
        let client = HelperClient(baseURL: URL(string: "http://127.0.0.1:42731")!, transport: transport)
        client.bearerToken = "approved-token"

        _ = try await client.respond(to: "request-1", response: RequestResponse(action: .allow))

        XCTAssertEqual(transport.requests[0].url?.path, "/requests/request-1/response")
        XCTAssertEqual(transport.requests[0].httpMethod, "POST")
        XCTAssertEqual(transport.requests[0].value(forHTTPHeaderField: "authorization"), "Bearer approved-token")
    }
}

private final class FakeTransport: HTTPTransport, @unchecked Sendable {
    var requests: [URLRequest] = []
    var responses: [(Data, HTTPURLResponse)] = []

    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        requests.append(request)
        return responses.removeFirst()
    }
}

private func jsonResponse(_ json: String, statusCode: Int = 200) -> (Data, HTTPURLResponse) {
    (
        json.data(using: .utf8)!,
        HTTPURLResponse(
            url: URL(string: "http://127.0.0.1:42731")!,
            statusCode: statusCode,
            httpVersion: nil,
            headerFields: ["content-type": "application/json"]
        )!
    )
}
```

- [ ] **Step 2: Run client tests and confirm failure**

Run: `swift test --filter HelperClientTests`.

Expected: FAIL because `HelperClient` and `HTTPTransport` do not exist.

- [ ] **Step 3: Implement transport and client**

Create `HTTPTransport.swift`:

```swift
import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public protocol HTTPTransport: Sendable {
    func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse)
}

public struct URLSessionHTTPTransport: HTTPTransport {
    public init() {}

    public func data(for request: URLRequest) async throws -> (Data, HTTPURLResponse) {
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw HelperClientError.invalidHTTPResponse
        }
        return (data, httpResponse)
    }
}
```

Create `HelperClient.swift`:

```swift
import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public final class HelperClient: @unchecked Sendable {
    public let baseURL: URL
    public var bearerToken: String?

    private let transport: HTTPTransport
    private let decoder = JSONDecoder.agentsInWatch
    private let encoder = JSONEncoder.agentsInWatch

    public init(baseURL: URL, transport: HTTPTransport = URLSessionHTTPTransport()) {
        self.baseURL = baseURL
        self.transport = transport
    }

    public func claimPairing(code: String, deviceName: String) async throws -> PairingClaim {
        let body = ["code": code, "deviceName": deviceName]
        let claim: PairingClaim = try await send(
            path: "/pairing/claims",
            method: "POST",
            body: body,
            requiresAuth: false
        )
        storeTokenIfApproved(claim)
        return claim
    }

    public func refreshClaim(id: String) async throws -> PairingClaim {
        let claim: PairingClaim = try await send(
            path: "/pairing/claims/\\(id)",
            method: "GET",
            body: Optional<String>.none,
            requiresAuth: false
        )
        storeTokenIfApproved(claim)
        return claim
    }

    public func listPendingRequests() async throws -> [AgentRequest] {
        let response: PendingRequestsResponse = try await send(
            path: "/requests",
            method: "GET",
            body: Optional<String>.none,
            requiresAuth: true
        )
        return response.requests
    }

    public func respond(to requestId: String, response: RequestResponse) async throws -> AgentRequest {
        try await send(
            path: "/requests/\\(requestId)/response",
            method: "POST",
            body: response,
            requiresAuth: true
        )
    }

    private func send<Response: Decodable, Body: Encodable>(
        path: String,
        method: String,
        body: Body?,
        requiresAuth: Bool
    ) async throws -> Response {
        var request = URLRequest(url: url(for: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "accept")

        if requiresAuth {
            guard let bearerToken else {
                throw HelperClientError.missingBearerToken
            }
            request.setValue("Bearer \\(bearerToken)", forHTTPHeaderField: "authorization")
        }

        if let body {
            request.httpBody = try encoder.encode(body)
            request.setValue("application/json", forHTTPHeaderField: "content-type")
        }

        let (data, response) = try await transport.data(for: request)
        guard (200..<300).contains(response.statusCode) else {
            throw HelperClientError.httpStatus(response.statusCode)
        }

        return try decoder.decode(Response.self, from: data)
    }

    private func storeTokenIfApproved(_ claim: PairingClaim) {
        if claim.status == .approved, let token = claim.token {
            bearerToken = token
        }
    }

    private func url(for path: String) -> URL {
        var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false)!
        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let nextPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let joinedPath = [basePath, nextPath].filter { !$0.isEmpty }.joined(separator: "/")
        components.path = "/" + joinedPath
        return components.url!
    }
}

public enum HelperClientError: Error, Equatable {
    case missingBearerToken
    case invalidHTTPResponse
    case httpStatus(Int)
}
```

- [ ] **Step 4: Run Swift tests and confirm pass**

Run: `swift test --filter HelperClientTests`.

Expected: PASS, 4 tests.

## Task 4: README Update and Full Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README mobile status**

Add this section before `## Safety`:

```md
## iPhone Companion Core

The repository now includes a Swift Package for the iPhone companion core:

```bash
cd mobile/ios/AgentsInWatchCore
swift test
```

The package currently contains tested models and a helper API client. It does not yet include SwiftUI screens, QR scanning, Keychain token storage, or WatchConnectivity.
```

- [ ] **Step 2: Run Node tests**

Run: `npm test` from the repo root.

Expected: PASS, 19 tests.

- [ ] **Step 3: Run Swift tests**

Run: `swift test` from `mobile/ios/AgentsInWatchCore`.

Expected: PASS, 4 tests.

- [ ] **Step 4: Commit**

```bash
git add README.md mobile/ios/AgentsInWatchCore
git commit -m "feat: add iphone companion core"
```

## Self-Review Notes

- Spec coverage: this plan implements the iPhone companion's first logic layer for pairing, token use, pending request display data, and response submission.
- Placeholder scan: no TBD/TODO placeholders; UI and Watch work are explicitly out of scope.
- Type consistency: Swift model names map directly to Desktop Helper JSON fields and actions.
