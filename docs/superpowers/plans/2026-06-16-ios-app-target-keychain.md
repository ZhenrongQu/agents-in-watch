# iOS App Target and Keychain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a minimal Xcode iPhone app target that launches the existing companion UI, and persist approved helper credentials so users do not have to pair again on every launch.

**Architecture:** Keep business logic in the existing Swift package. Add a small credential-store abstraction in `AgentsInWatchCore`, use a Keychain-backed default store for the app, and keep an in-memory store for tests. Add a lightweight Xcode project that depends on the local Swift package product `AgentsInWatchMobileUI`.

**Tech Stack:** Swift 6.1, Swift Package Manager, SwiftUI, Security/Keychain, Testing, Xcode project files.

---

## Scope

This plan implements:

- A stored pairing credential model containing helper URL and bearer token.
- A credential-store protocol, in-memory store for tests, and Keychain-backed store for Apple platforms.
- ViewModel restore/save/clear behavior wired into pairing approval and disconnect.
- A minimal iPhone app source entry point that renders `CompanionRootView`.
- A minimal Xcode project and shared scheme pointing at the local Swift package.
- README instructions for opening the iPhone app target.

This plan does not implement QR scanning, WatchConnectivity, notifications, app icons, TestFlight/App Store distribution, or full simulator UI automation.

## File Structure

- Modify `mobile/ios/AgentsInWatchCore/Package.swift`: link the Security framework for `AgentsInWatchCore`.
- Create `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/PairingCredentialStore.swift`: stored credential model, protocol, in-memory store, Keychain store, and errors.
- Modify `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`: restore saved credentials on init, save credentials after approval, clear credentials on disconnect.
- Modify `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`: inject in-memory store and test restore/save/clear.
- Create `mobile/ios/AgentsInWatchApp/AgentsInWatchApp.swift`: app entry point.
- Create `mobile/ios/AgentsInWatchApp/Assets.xcassets/Contents.json`: asset catalog root.
- Create `mobile/ios/AgentsInWatchApp/Assets.xcassets/AccentColor.colorset/Contents.json`: accent color placeholder.
- Create `mobile/ios/AgentsInWatchApp/Assets.xcassets/AppIcon.appiconset/Contents.json`: app icon placeholder.
- Create `mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj`: app target project file.
- Create `mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme`: shared scheme.
- Modify `README.md`: document how to open and run the iPhone app target.

## Task 1: Credential Store

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Package.swift`
- Create: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/PairingCredentialStore.swift`

- [ ] **Step 1: Add the credential store implementation**

Create `PairingCredentialStore.swift`:

```swift
import Foundation
#if canImport(Security)
import Security
#endif

public struct StoredPairingCredential: Codable, Equatable, Sendable {
    public let helperURL: URL
    public let bearerToken: String

    public init(helperURL: URL, bearerToken: String) {
        self.helperURL = helperURL
        self.bearerToken = bearerToken
    }
}

public protocol PairingCredentialStore: Sendable {
    func load() throws -> StoredPairingCredential?
    func save(_ credential: StoredPairingCredential) throws
    func clear() throws
}

public final class InMemoryPairingCredentialStore: PairingCredentialStore, @unchecked Sendable {
    private var credential: StoredPairingCredential?

    public init(credential: StoredPairingCredential? = nil) {
        self.credential = credential
    }

    public func load() throws -> StoredPairingCredential? {
        credential
    }

    public func save(_ credential: StoredPairingCredential) throws {
        self.credential = credential
    }

    public func clear() throws {
        credential = nil
    }
}

public final class KeychainPairingCredentialStore: PairingCredentialStore, @unchecked Sendable {
    private let service: String
    private let account: String
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()

    public init(
        service: String = "dev.agents-in-watch.pairing",
        account: String = "default"
    ) {
        self.service = service
        self.account = account
    }

    public func load() throws -> StoredPairingCredential? {
        #if canImport(Security)
        let query = baseQuery([
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ])
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess else {
            throw KeychainPairingCredentialStoreError.unhandledStatus(status)
        }
        guard let data = item as? Data else {
            throw KeychainPairingCredentialStoreError.invalidStoredData
        }
        return try decoder.decode(StoredPairingCredential.self, from: data)
        #else
        throw KeychainPairingCredentialStoreError.unavailable
        #endif
    }

    public func save(_ credential: StoredPairingCredential) throws {
        #if canImport(Security)
        let data = try encoder.encode(credential)
        try clear()
        let status = SecItemAdd(baseQuery([
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        ]) as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainPairingCredentialStoreError.unhandledStatus(status)
        }
        #else
        throw KeychainPairingCredentialStoreError.unavailable
        #endif
    }

    public func clear() throws {
        #if canImport(Security)
        let status = SecItemDelete(baseQuery([:]) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainPairingCredentialStoreError.unhandledStatus(status)
        }
        #else
        throw KeychainPairingCredentialStoreError.unavailable
        #endif
    }

    private func baseQuery(_ values: [String: Any]) -> [String: Any] {
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        values.forEach { query[$0.key] = $0.value }
        return query
    }
}

public enum KeychainPairingCredentialStoreError: Error, Equatable {
    case unavailable
    case invalidStoredData
    case unhandledStatus(OSStatus)
}
```

Modify the `AgentsInWatchCore` target in `Package.swift`:

```swift
.target(
    name: "AgentsInWatchCore",
    linkerSettings: [
        .linkedFramework("Security")
    ]
),
```

- [ ] **Step 2: Run Swift tests**

Run: `swift test` from `mobile/ios/AgentsInWatchCore`.

Expected: PASS with existing tests. This proves the new store compiles before the ViewModel uses it.

- [ ] **Step 3: Commit**

```bash
git add mobile/ios/AgentsInWatchCore/Package.swift mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchCore/PairingCredentialStore.swift
git commit -m "feat: add pairing credential store"
```

## Task 2: ViewModel Persistence

**Files:**
- Modify: `mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift`
- Modify: `mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift`

- [ ] **Step 1: Add failing tests**

Add tests to `CompanionViewModelTests`:

```swift
@Test func startsConnectedWhenCredentialExists() async {
    let request = sampleRequest(id: "request-1")
    let store = InMemoryPairingCredentialStore(
        credential: StoredPairingCredential(
            helperURL: URL(string: "http://127.0.0.1:42731")!,
            bearerToken: "saved-token"
        )
    )
    let fakeClient = FakeClient()
    fakeClient.pendingRequestResults = [[request]]
    let model = CompanionViewModel(
        credentialStore: store,
        clientFactory: { _ in fakeClient }
    )

    await model.loadPendingRequests()

    #expect(model.phase == .connected)
    #expect(model.helperURLText == "http://127.0.0.1:42731")
    #expect(fakeClient.bearerToken == "saved-token")
    #expect(model.pendingRequests == [request])
}

@Test func savesApprovedCredentialAfterPairingApproval() async throws {
    let store = InMemoryPairingCredentialStore()
    let fakeClient = FakeClient()
    fakeClient.claimPairingResult = PairingClaim(
        id: "claim-1",
        pairingSessionId: "session-1",
        deviceName: "Quinn iPhone",
        status: .approved,
        token: "approved-token"
    )
    fakeClient.pendingRequestResults = [[]]
    let model = CompanionViewModel(
        helperURLText: "http://127.0.0.1:42731",
        pairingCode: "123456",
        deviceName: "Quinn iPhone",
        credentialStore: store,
        clientFactory: { _ in fakeClient }
    )

    await model.claimPairing()

    #expect(try store.load() == StoredPairingCredential(
        helperURL: URL(string: "http://127.0.0.1:42731")!,
        bearerToken: "approved-token"
    ))
}

@Test func clearsSavedCredentialOnDisconnect() async throws {
    let store = InMemoryPairingCredentialStore(
        credential: StoredPairingCredential(
            helperURL: URL(string: "http://127.0.0.1:42731")!,
            bearerToken: "saved-token"
        )
    )
    let model = CompanionViewModel(
        credentialStore: store,
        clientFactory: { _ in FakeClient() }
    )

    model.disconnect()

    #expect(try store.load() == nil)
    #expect(model.phase == .disconnected)
}
```

Also update existing `CompanionViewModel()` test construction to pass `credentialStore: InMemoryPairingCredentialStore()` so tests never touch the real Keychain.

- [ ] **Step 2: Run tests and confirm failure**

Run: `swift test --filter CompanionViewModelTests`.

Expected: FAIL because `CompanionViewModel` does not accept a credential store yet.

- [ ] **Step 3: Implement ViewModel persistence**

Update `CompanionViewModel` with:

```swift
private let credentialStore: any PairingCredentialStore
```

Add `credentialStore` to the initializer before `clientFactory`, defaulting to `KeychainPairingCredentialStore()`. In the initializer, load any saved credential. If one exists, set `helperURLText`, create a client, set its bearer token, set `client`, and start in `.connected`.

After an approved claim, save:

```swift
try credentialStore.save(StoredPairingCredential(helperURL: url, bearerToken: token))
```

In `disconnect()`, clear:

```swift
try? credentialStore.clear()
```

- [ ] **Step 4: Run Swift tests**

Run: `swift test` from `mobile/ios/AgentsInWatchCore`.

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/ios/AgentsInWatchCore/Sources/AgentsInWatchMobileUI/CompanionViewModel.swift mobile/ios/AgentsInWatchCore/Tests/AgentsInWatchMobileUITests/CompanionViewModelTests.swift
git commit -m "feat: persist companion pairing credentials"
```

## Task 3: Xcode iPhone App Target

**Files:**
- Create: `mobile/ios/AgentsInWatchApp/AgentsInWatchApp.swift`
- Create: `mobile/ios/AgentsInWatchApp/Assets.xcassets/Contents.json`
- Create: `mobile/ios/AgentsInWatchApp/Assets.xcassets/AccentColor.colorset/Contents.json`
- Create: `mobile/ios/AgentsInWatchApp/Assets.xcassets/AppIcon.appiconset/Contents.json`
- Create: `mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj`
- Create: `mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme`

- [ ] **Step 1: Add app entry point**

Create `AgentsInWatchApp.swift`:

```swift
import AgentsInWatchMobileUI
import SwiftUI

@main
struct AgentsInWatchApp: App {
    var body: some Scene {
        WindowGroup {
            CompanionRootView()
        }
    }
}
```

- [ ] **Step 2: Add Xcode project and scheme**

Create an Xcode project named `AgentsInWatch.xcodeproj` with one iOS application target named `AgentsInWatch`. The target must:

- Use bundle identifier `dev.agentsinwatch.AgentsInWatch`.
- Generate its Info.plist.
- Include `AgentsInWatchApp.swift`.
- Include `Assets.xcassets`.
- Depend on the local Swift package at `AgentsInWatchCore`.
- Link the local package product `AgentsInWatchMobileUI`.

- [ ] **Step 3: Verify project file format**

Run:

```bash
plutil -lint mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme
```

Expected: the project file reports `OK` and `xmllint` exits with no output.

- [ ] **Step 4: Commit**

```bash
git add mobile/ios/AgentsInWatch.xcodeproj mobile/ios/AgentsInWatchApp
git commit -m "feat: add iPhone app target"
```

## Task 4: Documentation and Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update README**

Add iPhone app instructions:

```markdown
## iPhone App

The repository includes a minimal Xcode iPhone app target that hosts the companion SwiftUI interface.

Open:

```bash
open mobile/ios/AgentsInWatch.xcodeproj
```

Select the `AgentsInWatch` scheme, choose an iPhone simulator or device, and run. The app uses the local Swift package at `mobile/ios/AgentsInWatchCore`.
```

Also note that full app builds require Xcode, not just Command Line Tools.

- [ ] **Step 2: Run final tests**

Run:

```bash
npm test
swift test
```

Run `swift test` from `mobile/ios/AgentsInWatchCore`.

Expected:

- Node tests pass.
- Swift tests pass.

- [ ] **Step 3: Verify Xcode project files**

Run:

```bash
plutil -lint mobile/ios/AgentsInWatch.xcodeproj/project.pbxproj
xmllint --noout mobile/ios/AgentsInWatch.xcodeproj/xcshareddata/xcschemes/AgentsInWatch.xcscheme
```

Expected: the project file reports `OK` and `xmllint` exits with no output.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: document iPhone app target"
```

## Verification Notes

The current local machine has Xcode Command Line Tools active, not full Xcode, so `xcodebuild` cannot verify the iOS app target here. This plan uses SwiftPM tests for the reusable app logic, `plutil` for the Xcode project file, and `xmllint` for the Xcode scheme XML. A later pass on a machine with full Xcode should run:

```bash
xcodebuild -project mobile/ios/AgentsInWatch.xcodeproj -scheme AgentsInWatch -destination 'platform=iOS Simulator,name=iPhone 15' build
```
