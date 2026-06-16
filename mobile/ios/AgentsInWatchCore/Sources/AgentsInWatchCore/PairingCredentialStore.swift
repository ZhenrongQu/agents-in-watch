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
