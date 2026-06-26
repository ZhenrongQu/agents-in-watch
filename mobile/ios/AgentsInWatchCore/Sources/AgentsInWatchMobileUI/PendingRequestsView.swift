import AgentsInWatchCore
import SwiftUI

struct PendingRequestsView: View {
    @ObservedObject var model: CompanionViewModel

    var body: some View {
        GeometryReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    RequestDashboardHeader(model: model)

                    StatusDashboard(
                        watchStatus: model.watchStatus,
                        notificationStatus: model.notificationStatus,
                        autoRefreshStatus: model.autoRefreshStatus
                    )

                    if model.pendingRequests.isEmpty {
                        EmptyRequestsDashboard()
                            .frame(minHeight: emptyStateHeight(for: proxy.size.height))
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
                .frame(minHeight: proxy.size.height, alignment: .top)
                .padding(.horizontal, 16)
                .padding(.top, 4)
                .padding(.bottom, 18)
            }
        }
        .background(AppSurface.background)
        .refreshable {
            await model.loadPendingRequests()
        }
        .task {
            if model.pendingRequests.isEmpty {
                await model.loadPendingRequests()
            }
        }
    }

    private func emptyStateHeight(for screenHeight: CGFloat) -> CGFloat {
        max(220, screenHeight - 280)
    }
}

private struct RequestDashboardHeader: View {
    @ObservedObject var model: CompanionViewModel

    var body: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Requests")
                    .font(.system(.title2, design: .rounded).weight(.bold))
                Text("Approvals from your agent sessions.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            Spacer(minLength: 8)

            HStack(spacing: 8) {
                Button {
                    Task { await model.loadPendingRequests() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.bordered)
                .disabled(model.isLoading)
                .accessibilityLabel("Refresh")

                Button(role: .destructive) {
                    model.disconnect()
                } label: {
                    Image(systemName: "iphone.slash")
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.bordered)
                .accessibilityLabel("Disconnect")
            }
        }
    }
}

private struct StatusDashboard: View {
    let watchStatus: WatchRequestBridgeStatus
    let notificationStatus: NotificationBridgeStatus
    let autoRefreshStatus: AutoRefreshStatus

    var body: some View {
        VStack(spacing: 8) {
            StatusTile(title: watchStatus.title, detail: watchStatus.detail, systemImage: "applewatch")
            StatusTile(title: notificationStatus.title, detail: notificationStatus.detail, systemImage: "bell")
            StatusTile(title: autoRefreshStatus.title, detail: autoRefreshStatus.detail, systemImage: "arrow.triangle.2.circlepath")
        }
    }
}

private struct StatusTile: View {
    let title: String
    let detail: String
    let systemImage: String

    var body: some View {
        Label {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title)
                    .font(.callout.weight(.semibold))
                    .lineLimit(1)

                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        } icon: {
            Image(systemName: systemImage)
                .font(.body.weight(.semibold))
                .foregroundStyle(.blue)
                .frame(width: 24)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .surfaceCardBackground()
    }
}

private struct EmptyRequestsDashboard: View {
    var body: some View {
        VStack(spacing: 14) {
            Spacer(minLength: 4)

            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(.green)

            VStack(spacing: 6) {
                Text("No Pending Requests")
                    .font(.title3.weight(.bold))
                Text("When Codex Desktop or Claude Code needs approval, it will appear here and on your Watch.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }

            Spacer(minLength: 4)

            Label("Waiting for agent activity", systemImage: "dot.radiowaves.left.and.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(.secondary.opacity(0.12), in: Capsule())
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(18)
        .surfaceCardBackground()
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
                ForEach(request.userFacingActions, id: \.self) { action in
                    actionButton(for: action)
                }
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .surfaceCardBackground()
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
