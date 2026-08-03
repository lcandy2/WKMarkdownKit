import Foundation
import Testing

@testable import WKMarkdownKit

@Suite struct PayloadTests {
    @Test func payloadRoundTrips() throws {
        let payload = ConversationPayload(
            segments: [
                .init(
                    id: "s1",
                    isLive: false,
                    workedLabel: "Worked for 10s",
                    user: [.init(id: "u1", kind: "user", text: "hi")],
                    process: [
                        .init(
                            id: "t1",
                            kind: "tool",
                            title: "Ran pwd",
                            status: "success",
                            output: "/tmp",
                            symbol: "terminal"
                        )
                    ],
                    conclusion: [
                        .init(id: "a1", kind: "assistant", text: "done")
                    ]
                )
            ],
            hasMoreOlder: true,
            working: false,
            plan: .init(id: "p1", content: "## Plan")
        )
        let data = try JSONEncoder().encode(payload)
        let back = try JSONDecoder().decode(
            ConversationPayload.self, from: data
        )
        #expect(back == payload)
    }

    @Test func resourcesShipInBundle() {
        let resources = Bundle.module.url(
            forResource: "WebRoot",
            withExtension: nil
        )
        #expect(resources != nil)
        if let resources {
            for name in [
                "page.html", "wkmarkdownkit.css", "wkmarkdownkit.js",
                "wkmarkdownkit-preflight.css",
                "vendor/marked.min.js", "vendor/highlight.min.js",
                "vendor/remend.esm.js", "wkmarkdownkit-hljs.css",
            ] {
                let url = resources.appendingPathComponent(name)
                #expect(
                    FileManager.default.fileExists(atPath: url.path),
                    "missing \(name)"
                )
            }
        }
    }
}
