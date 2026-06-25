import SwiftUI

#if os(macOS)
import AppKit
#endif

enum AppSurface {
    #if os(iOS)
    static let background = LinearGradient(
        colors: [
            Color(uiColor: .systemBackground),
            Color(uiColor: .secondarySystemBackground)
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    static let cardBackground = Color(uiColor: .secondarySystemGroupedBackground)
    #elseif os(macOS)
    static let background = LinearGradient(
        colors: [
            Color(nsColor: .windowBackgroundColor),
            Color(nsColor: .controlBackgroundColor)
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    static let cardBackground = Color(nsColor: .controlBackgroundColor)
    #else
    static let background = LinearGradient(
        colors: [Color.black, Color.black],
        startPoint: .top,
        endPoint: .bottom
    )

    static let cardBackground = Color.white.opacity(0.08)
    #endif
}

struct SurfaceCard<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(AppSurface.cardBackground, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

struct StatusLine: View {
    let title: String
    let detail: String
    let systemImage: String

    var body: some View {
        Label {
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        } icon: {
            Image(systemName: systemImage)
                .foregroundStyle(.blue)
        }
    }
}
