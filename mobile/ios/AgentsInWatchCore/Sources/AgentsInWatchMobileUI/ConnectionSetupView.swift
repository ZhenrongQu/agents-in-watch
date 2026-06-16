import SwiftUI

struct ConnectionSetupView: View {
    @ObservedObject var model: CompanionViewModel

    var body: some View {
        Form {
            Section("Computer Helper") {
                TextField("Helper URL", text: $model.helperURLText)
                    .textContentType(.URL)
                    .modifier(URLFieldModifier())

                TextField("Pairing code", text: $model.pairingCode)
                    .modifier(PairingCodeFieldModifier())

                TextField("Device name", text: $model.deviceName)
            }

            Section {
                switch model.phase {
                case .disconnected:
                    Button {
                        Task { await model.claimPairing() }
                    } label: {
                        Label("Pair iPhone", systemImage: "iphone.gen3.radiowaves.left.and.right")
                    }
                    .disabled(model.isLoading)
                case .awaitingApproval:
                    Button {
                        Task { await model.refreshPairing() }
                    } label: {
                        Label("Check Approval", systemImage: "arrow.clockwise")
                    }
                    .disabled(model.isLoading)
                case .connected:
                    EmptyView()
                }
            }

            if model.isLoading {
                Section {
                    ProgressView()
                }
            }

            if let errorMessage = model.errorMessage {
                Section {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                }
            }
        }
    }
}

private struct URLFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        #if os(iOS)
        content
            .keyboardType(.URL)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
        #else
        content
        #endif
    }
}

private struct PairingCodeFieldModifier: ViewModifier {
    func body(content: Content) -> some View {
        #if os(iOS)
        content
            .keyboardType(.numberPad)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
        #else
        content
        #endif
    }
}
