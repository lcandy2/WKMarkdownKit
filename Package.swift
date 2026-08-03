// swift-tools-version: 5.9
import PackageDescription

// WKMarkdownKit — a WKWebView-based streaming markdown / conversation
// renderer. Born as Cog's web transcript experiment; the core is kept
// free of Cog types so it can graduate into a standalone open-source
// project (working titles: WKMarkdownKit / WKMarkdownView).
let package = Package(
    name: "WKMarkdownKit",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    products: [
        .library(name: "WKMarkdownKit", targets: ["WKMarkdownKit"])
    ],
    targets: [
        .target(
            name: "WKMarkdownKit",
            resources: [
                .copy("WebRoot")
            ]
        ),
        .testTarget(
            name: "WKMarkdownKitTests",
            dependencies: ["WKMarkdownKit"]
        ),
    ]
)
