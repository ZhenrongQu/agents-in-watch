import AgentsInWatchCore
import SwiftUI

public struct CompanionRootView: View {
    @StateObject private var model: CompanionViewModel

    @MainActor
    public init(model: CompanionViewModel = CompanionViewModel()) {
        _model = StateObject(wrappedValue: model)
    }

    public var body: some View {
        NavigationStack {
            Group {
                switch model.phase {
                case .disconnected, .awaitingApproval:
                    ConnectionSetupView(model: model)
                case .connected:
                    PendingRequestsView(model: model)
                }
            }
            .navigationTitle("Agents")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
        }
    }
}
