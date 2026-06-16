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
                        WatchRequestRow(request: request)
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

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(request.projectName)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Circle()
                    .fill(riskColor)
                    .frame(width: 8, height: 8)
            }

            Text(request.watchSummary)
                .font(.caption)
                .lineLimit(3)

            Text(request.agentType.rawValue)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
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
}
