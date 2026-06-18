import AgentsInWatchCore
import SwiftUI

public struct WatchRequestsView: View {
    @ObservedObject private var model: WatchRequestsViewModel

    public init(model: WatchRequestsViewModel = WatchRequestsViewModel()) {
        self.model = model
    }

    public var body: some View {
        NavigationStack {
            List {
                VStack(alignment: .leading, spacing: 4) {
                    Label(model.responseStatus.title, systemImage: "iphone")
                        .font(.caption)
                    Text(model.responseStatus.detail)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)

                if model.requests.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Image(systemName: "checkmark.circle")
                            .foregroundStyle(.green)
                        Text("No Requests")
                            .font(.headline)
                        Text("Agents are not waiting.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 8)
                } else {
                    ForEach(model.requests) { request in
                        WatchRequestRow(request: request, model: model)
                    }
                }

                if let errorMessage = model.errorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .navigationTitle("Agents")
        }
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
                ForEach(request.actions, id: \.self) { action in
                    actionButton(for: action)
                }
            }
            .buttonStyle(.bordered)
        }
        .padding(.vertical, 4)
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
