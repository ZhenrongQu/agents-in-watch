import AgentsInWatchCore
import SwiftUI

struct PendingRequestsView: View {
    @ObservedObject var model: CompanionViewModel

    var body: some View {
        List {
            Section("Watch") {
                Label(model.watchStatus.title, systemImage: "applewatch")
                    .font(.subheadline)
                Text(model.watchStatus.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Notifications") {
                Label(model.notificationStatus.title, systemImage: "bell")
                    .font(.subheadline)
                Text(model.notificationStatus.detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if model.pendingRequests.isEmpty {
                ContentUnavailableView(
                    "No Pending Requests",
                    systemImage: "checkmark.circle",
                    description: Text("Your agents are not waiting for a response.")
                )
                .listRowSeparator(.hidden)
            } else {
                ForEach(model.pendingRequests) { request in
                    RequestRow(request: request) { action, message in
                        Task {
                            await model.send(action: action, for: request, message: message)
                        }
                    }
                }
            }

            if model.isLoading {
                ProgressView()
            }

            if let errorMessage = model.errorMessage {
                Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
            }
        }
        .navigationTitle("Requests")
        .refreshable {
            await model.loadPendingRequests()
        }
        .toolbar {
            #if os(iOS)
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    Task { await model.loadPendingRequests() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(model.isLoading)

                Button(role: .destructive) {
                    model.disconnect()
                } label: {
                    Image(systemName: "iphone.slash")
                }
            }
            #else
            ToolbarItemGroup(placement: .automatic) {
                Button {
                    Task { await model.loadPendingRequests() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(model.isLoading)

                Button(role: .destructive) {
                    model.disconnect()
                } label: {
                    Image(systemName: "iphone.slash")
                }
            }
            #endif
        }
        .task {
            if model.pendingRequests.isEmpty {
                await model.loadPendingRequests()
            }
        }
    }
}

private struct RequestRow: View {
    let request: AgentRequest
    let onAction: (RequestAction, String?) -> Void

    @State private var isReplySheetPresented = false
    @State private var replyText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: iconName)
                    .foregroundStyle(iconColor)
                    .font(.title3)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 4) {
                    Text(request.title)
                        .font(.headline)
                    Text("\(request.agentType.rawValue) - \(request.projectName)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 8)

                RiskBadge(riskLevel: request.riskLevel)
            }

            Text(request.watchSummary)
                .font(.body)

            if !request.phoneContext.isEmpty {
                Text(request.phoneContext)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }

            HStack {
                ForEach(request.actions, id: \.self) { action in
                    actionButton(for: action)
                }
            }
            .buttonStyle(.bordered)
        }
        .padding(.vertical, 8)
        .sheet(isPresented: $isReplySheetPresented) {
            ReplySheet(replyText: $replyText) {
                onAction(.reply, replyText)
                replyText = ""
                isReplySheetPresented = false
            } onCancel: {
                replyText = ""
                isReplySheetPresented = false
            }
        }
    }

    private var iconName: String {
        switch request.agentType {
        case .claudeCode:
            "terminal"
        case .codexDesktop:
            "desktopcomputer"
        }
    }

    private var iconColor: Color {
        switch request.riskLevel {
        case .low:
            .green
        case .medium:
            .orange
        case .high:
            .red
        }
    }

    @ViewBuilder
    private func actionButton(for action: RequestAction) -> some View {
        switch action {
        case .allow:
            Button {
                onAction(.allow, nil)
            } label: {
                Label("Allow", systemImage: "checkmark.circle")
            }
            .buttonStyle(.borderedProminent)
        case .deny:
            Button(role: .destructive) {
                onAction(.deny, nil)
            } label: {
                Label("Deny", systemImage: "xmark.circle")
            }
        case .pause:
            Button {
                onAction(.pause, nil)
            } label: {
                Label("Pause", systemImage: "pause.circle")
            }
        case .reply:
            Button {
                isReplySheetPresented = true
            } label: {
                Label("Reply", systemImage: "bubble.left")
            }
        case .openPhone:
            Button {
                isReplySheetPresented = true
            } label: {
                Label("Open", systemImage: "iphone")
            }
        }
    }
}

private struct RiskBadge: View {
    let riskLevel: RiskLevel

    var body: some View {
        Text(riskLevel.rawValue.capitalized)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12), in: Capsule())
    }

    private var color: Color {
        switch riskLevel {
        case .low:
            .green
        case .medium:
            .orange
        case .high:
            .red
        }
    }
}

private struct ReplySheet: View {
    @Binding var replyText: String
    let onSend: () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            TextEditor(text: $replyText)
                .padding()
                .navigationTitle("Reply")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel", action: onCancel)
                    }

                    ToolbarItem(placement: .confirmationAction) {
                        Button("Send", action: onSend)
                            .disabled(replyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                }
        }
    }
}
