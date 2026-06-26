import SwiftUI

#if os(iOS)
import UIKit
#endif

#if os(macOS)
import AppKit
#endif

enum AppSurface {
    #if os(iOS)
    private static let paper = Color(red: 0.984, green: 0.984, blue: 0.976)
    private static let paperDeep = Color(red: 0.953, green: 0.949, blue: 0.929)
    private static let border = Color(red: 0.902, green: 0.894, blue: 0.863)

    static let background = LinearGradient(
        colors: [
            paper,
            paperDeep
        ],
        startPoint: .top,
        endPoint: .bottom
    )

    static let cardBackground = Color.white
    static let cardBorder = border
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
    static let cardBorder = Color(nsColor: .separatorColor)
    #else
    static let background = LinearGradient(
        colors: [Color.black, Color.black],
        startPoint: .top,
        endPoint: .bottom
    )

    static let cardBackground = Color.white.opacity(0.08)
    static let cardBorder = Color.white.opacity(0.12)
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
        .surfaceCardBackground()
    }
}

private struct SurfaceCardBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
        .background(AppSurface.cardBackground, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .stroke(AppSurface.cardBorder, lineWidth: 1)
        )
    }
}

extension View {
    func surfaceCardBackground() -> some View {
        modifier(SurfaceCardBackground())
    }
}
