// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "AgentsInWatchCore",
    platforms: [
        .iOS(.v17),
        .watchOS(.v10),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "AgentsInWatchCore",
            targets: ["AgentsInWatchCore"]
        )
    ],
    targets: [
        .target(name: "AgentsInWatchCore"),
        .testTarget(
            name: "AgentsInWatchCoreTests",
            dependencies: ["AgentsInWatchCore"]
        )
    ]
)
