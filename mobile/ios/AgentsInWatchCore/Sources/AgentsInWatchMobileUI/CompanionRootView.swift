import AgentsInWatchCore
import SwiftUI

public struct CompanionRootView: View {
    @StateObject private var model: CompanionViewModel

    @MainActor
    public init(model: CompanionViewModel = CompanionViewModel()) {
        _model = StateObject(wrappedValue: model)
    }

    public var body: some View {
        ZStack {
            AppSurface.background
                .ignoresSafeArea()

            Group {
                switch model.phase {
                case .disconnected, .awaitingApproval:
                    ConnectionSetupView(model: model)
                case .connected:
                    PendingRequestsView(model: model)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        #if os(iOS)
        .preferredColorScheme(.light)
        #endif
    }
}
