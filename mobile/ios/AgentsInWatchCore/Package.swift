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
        ),
        .library(
            name: "AgentsInWatchMobileUI",
            targets: ["AgentsInWatchMobileUI"]
        )
    ],
    targets: [
        .target(
            name: "AgentsInWatchCore",
            linkerSettings: [
                .linkedFramework("Security")
            ]
        ),
        .target(
            name: "AgentsInWatchMobileUI",
            dependencies: ["AgentsInWatchCore"]
        ),
        .testTarget(
            name: "AgentsInWatchCoreTests",
            dependencies: ["AgentsInWatchCore"]
        ),
        .testTarget(
            name: "AgentsInWatchMobileUITests",
            dependencies: ["AgentsInWatchMobileUI"]
        )
    ]
)
