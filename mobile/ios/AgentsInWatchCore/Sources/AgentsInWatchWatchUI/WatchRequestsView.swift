import AgentsInWatchCore
import SwiftUI

public struct WatchRequestsView: View {
    @ObservedObject private var model: WatchRequestsViewModel

    public init(model: WatchRequestsViewModel = WatchRequestsViewModel()) {
        self.model = model
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("Agents")
                    .font(.headline)

                WatchStatusCard(
                    title: model.responseStatus.title,
                    detail: model.responseStatus.detail
                )

                if model.requests.isEmpty {
                    WatchEmptyState()
                } else {
                    ForEach(model.requests) { request in
                        WatchRequestRow(request: request, model: model)
                    }
                }

                if let errorMessage = model.errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption2)
                        .foregroundStyle(.red)
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.red.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
            }
            .padding(.horizontal, 8)
            .padding(.vertical, 6)
        }
        .background(Color.black.ignoresSafeArea())
    }
}

private struct WatchStatusCard: View {
    let title: String
    let detail: String

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption.weight(.semibold))
                Text(detail)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
        } icon: {
            Image(systemName: "iphone")
                .foregroundStyle(.blue)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct WatchEmptyState: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
            Text("No Requests")
                .font(.headline)
            Text("Agents are not waiting.")
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

private struct WatchRequestRow: View {
    let request: AgentRequest
    @ObservedObject var model: WatchRequestsViewModel
    @State private var isReplyPresented = false
    @State private var replyText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(request.title)
                    .font(.headline)
                    .lineLimit(2)
                Spacer()
                Circle()
                    .fill(riskColor)
                    .frame(width: 8, height: 8)
            }

            Text(request.watchSummary)
                .font(.caption)
                .lineLimit(3)

            Text("\(request.agentType.rawValue) - \(request.projectName)")
                .font(.caption2)
                .foregroundStyle(.secondary)

            HStack {
                ForEach(request.userFacingActions, id: \.self) { action in
                    actionButton(for: action)
                }
            }
            .buttonStyle(.bordered)
        }
        .padding(8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .sheet(isPresented: $isReplyPresented) {
            NavigationStack {
                TextField("Reply", text: $replyText)
                    .padding()
                    .navigationTitle("Reply")
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") {
                                replyText = ""
                                isReplyPresented = false
                            }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button("Send") {
                                model.send(action: .reply, for: request, message: replyText)
                                replyText = ""
                                isReplyPresented = false
                            }
                            .disabled(replyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        }
                    }
            }
        }
    }

    private var riskColor: Color {
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
                model.send(action: .allow, for: request)
            } label: {
                Image(systemName: "checkmark")
            }
        case .deny:
            Button(role: .destructive) {
                model.send(action: .deny, for: request)
            } label: {
                Image(systemName: "xmark")
            }
        case .pause:
            Button {
                model.send(action: .pause, for: request)
            } label: {
                Image(systemName: "pause")
            }
        case .reply, .openPhone:
            Button {
                isReplyPresented = true
            } label: {
                Image(systemName: "bubble.left")
            }
        }
    }
}
