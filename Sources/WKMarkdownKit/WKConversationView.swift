#if os(macOS)

    import SwiftUI
    import WebKit

    /// A WKWebView without the browser-flavored context items —
    /// Reload / Back / Forward make no sense on a transcript; the
    /// selection items (Copy, Look Up…) stay. Also feeds the titlebar
    /// safe-area inset into the page.
    private final class ChromelessWebView: WKWebView {
        override func layout() {
            super.layout()
            let top = safeAreaInsets.top
            evaluateJavaScript(
                "document.documentElement.style.setProperty("
                    + "'--safe-top','\(Int(top))px')"
            )
        }

        override func willOpenMenu(_ menu: NSMenu, with event: NSEvent) {
            super.willOpenMenu(menu, with: event)
            let banned: Set<String> = [
                "WKMenuItemIdentifierReload",
                "WKMenuItemIdentifierGoBack",
                "WKMenuItemIdentifierGoForward",
            ]
            menu.items = menu.items.filter { item in
                !banned.contains(item.identifier?.rawValue ?? "")
            }
        }
    }

    /// The conversation transcript rendered by WKMarkdownKit's web engine:
    /// turn folding, bare tool rows with animated detail wells, the
    /// continuous-cursor fog reveal, two-layer code cards, grid tables,
    /// in-flow plan approval, older-history paging — and the web
    /// engine's native continuous text selection.
    public struct WKConversationView: NSViewRepresentable {
        public var payload: ConversationPayload
        public var onPlanDecision:
            @MainActor (String, PlanCardDecision) -> Void
        public var onLoadOlder: @MainActor () -> Void

        public init(
            payload: ConversationPayload,
            onPlanDecision:
                @escaping @MainActor (String, PlanCardDecision) -> Void =
                { _, _ in },
            onLoadOlder: @escaping @MainActor () -> Void = {}
        ) {
            self.payload = payload
            self.onPlanDecision = onPlanDecision
            self.onLoadOlder = onLoadOlder
        }

        public func makeCoordinator() -> Coordinator { Coordinator() }

        public func makeNSView(context: Context) -> WKWebView {
            let configuration = WKWebViewConfiguration()
            configuration.userContentController.add(
                context.coordinator,
                name: "plan"
            )
            configuration.userContentController.add(
                context.coordinator,
                name: "history"
            )
            let web = ChromelessWebView(
                frame: .zero,
                configuration: configuration
            )
            web.navigationDelegate = context.coordinator
            web.uiDelegate = context.coordinator
            web.setValue(false, forKey: "drawsBackground")
            if let resources = Bundle.module.url(
                forResource: "WebRoot",
                withExtension: nil
            ) {
                web.loadFileURL(
                    resources.appendingPathComponent("page.html"),
                    allowingReadAccessTo: resources
                )
            }
            context.coordinator.web = web
            return web
        }

        public func updateNSView(_ web: WKWebView, context: Context) {
            context.coordinator.onPlanDecision = onPlanDecision
            context.coordinator.onLoadOlder = onLoadOlder
            context.coordinator.push(payload)
        }

        @MainActor
        public final class Coordinator: NSObject, WKNavigationDelegate,
            WKScriptMessageHandler, WKUIDelegate
        {
            weak var web: WKWebView?
            var onPlanDecision:
                @MainActor (String, PlanCardDecision) -> Void = { _, _ in }
            var onLoadOlder: @MainActor () -> Void = {}
            private var ready = false
            private var pending: String?

            func push(_ payload: ConversationPayload) {
                let data = (try? JSONEncoder().encode(payload))
                    ?? Data(#"{"segments":[]}"#.utf8)
                let json = String(decoding: data, as: UTF8.self)
                guard ready else {
                    pending = json
                    return
                }
                web?.evaluateJavaScript("cog.update(\(json))")
            }

            /// Links NEVER open inline — the transcript is not a
            /// browser. Only the page's own file:// load passes;
            /// everything else goes to the default browser.
            public func webView(
                _ webView: WKWebView,
                decidePolicyFor navigationAction: WKNavigationAction,
                decisionHandler: @escaping @MainActor (
                    WKNavigationActionPolicy
                ) -> Void
            ) {
                guard let url = navigationAction.request.url else {
                    decisionHandler(.cancel)
                    return
                }
                if url.isFileURL
                    || url.absoluteString == "about:blank"
                {
                    decisionHandler(.allow)
                    return
                }
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
            }

            /// target=_blank and window.open land here — same rule.
            public func webView(
                _ webView: WKWebView,
                createWebViewWith configuration: WKWebViewConfiguration,
                for navigationAction: WKNavigationAction,
                windowFeatures: WKWindowFeatures
            ) -> WKWebView? {
                if let url = navigationAction.request.url,
                    !url.isFileURL
                {
                    NSWorkspace.shared.open(url)
                }
                return nil
            }

            public func webView(
                _ webView: WKWebView,
                didFinish navigation: WKNavigation!
            ) {
                ready = true
                if let json = pending {
                    pending = nil
                    webView.evaluateJavaScript("cog.update(\(json))")
                }
            }

            public func userContentController(
                _ controller: WKUserContentController,
                didReceive message: WKScriptMessage
            ) {
                switch message.name {
                case "history":
                    onLoadOlder()
                case "plan":
                    guard let body = message.body as? [String: Any],
                        let requestId = body["requestId"] as? String,
                        let verb = body["decision"] as? String
                    else { return }
                    let decision: PlanCardDecision
                    switch verb {
                    case "approved":
                        decision = .approved
                    case "abandoned":
                        decision = .abandoned
                    case "cancelled":
                        let feedback = body["feedback"] as? String
                        decision = .cancelled(
                            feedback: (feedback?.isEmpty ?? true)
                                ? nil : feedback
                        )
                    default:
                        return
                    }
                    onPlanDecision(requestId, decision)
                default:
                    break
                }
            }
        }
    }

#endif
