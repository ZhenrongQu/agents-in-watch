import SwiftUI

struct ConnectionSetupView: View {
    @ObservedObject var model: CompanionViewModel

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Connect")
                        .font(.title.bold())
                    Text("Pair this iPhone with your Mac helper.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 8)

                SurfaceCard {
                    Label("Computer Helper", systemImage: "desktopcomputer")
                        .font(.headline)

                TextField("Helper URL", text: $model.helperURLText)
                    .textContentType(.URL)
                    .modifier(URLFieldModifier())
                    .textFieldStyle(.roundedBorder)

                TextField("Pairing code", text: $model.pairingCode)
                    .modifier(PairingCodeFieldModifier())
                    .textFieldStyle(.roundedBorder)

                TextField("Device name", text: $model.deviceName)
                    .textFieldStyle(.roundedBorder)
            }

                SurfaceCard {
                switch model.phase {
                case .disconnected:
                    Button {
                        Task { await model.claimPairing() }
                    } label: {
                        Label("Pair iPhone", systemImage: "iphone.gen3.radiowaves.left.and.right")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.isLoading)
                case .awaitingApproval:
                    Button {
                        Task { await model.refreshPairing() }
                    } label: {
                        Label("Check Approval", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(model.isLoading)
                case .connected:
                    EmptyView()
                }
            }

            if model.isLoading {
                    SurfaceCard {
                    ProgressView()
                            .frame(maxWidth: .infinity)
                }
            }

            if let errorMessage = model.errorMessage {
                    SurfaceCard {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .foregroundStyle(.red)
                }
            }
        }
            .padding(.horizontal, 16)
            .padding(.bottom, 24)
        }
        .scrollContentBackground(.hidden)
        .background(AppSurface.background.ignoresSafeArea())
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
