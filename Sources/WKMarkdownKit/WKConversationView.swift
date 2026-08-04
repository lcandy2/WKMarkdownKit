import SwiftUI
import WebKit

#if os(macOS)
    /// A WKWebView without the browser-flavored context items —
    /// Reload / Back / Forward make no sense on a transcript; the
    /// selection items (Copy, Look Up…) stay. Also feeds the titlebar
    /// safe-area inset into the page.
    private final class ChromelessWebView: WKWebView {
        private var lastSafeTop = Int.min

        override func layout() {
            super.layout()
            // Layout fires every frame of a split-view/inspector
            // animation; the inset only changes when the titlebar
            // does. Pushing JS per frame floods the WebContent
            // connection exactly when live-resize fences make it
            // slowest — send only on change.
            let top = Int(safeAreaInsets.top)
            guard top != lastSafeTop else { return }
            lastSafeTop = top
            evaluateJavaScript(
                "document.documentElement.style.setProperty("
                    + "'--safe-top','\(top)px')"
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
#else
    /// iOS twin: no browser context menu to strip (link previews are
    /// disabled at configuration instead); feeds BOTH safe-area
    /// insets into the page from layout — the view extends under the
    /// navigation bar and composer, and the page pads its scroll
    /// content so text glides behind their blur instead of being
    /// clipped above them.
    private final class ChromelessWebView: WKWebView {
        private var lastSafeTop = Int.min
        private var lastSafeBottom = Int.min

        override func layoutSubviews() {
            super.layoutSubviews()
            let top = Int(safeAreaInsets.top)
            let bottom = Int(safeAreaInsets.bottom)
            guard top != lastSafeTop || bottom != lastSafeBottom
            else { return }
            lastSafeTop = top
            lastSafeBottom = bottom
            evaluateJavaScript(
                "document.documentElement.style.setProperty("
                    + "'--safe-top','\(top)px');"
                    + "document.documentElement.style.setProperty("
                    + "'--safe-bottom','\(bottom)px')"
            )
        }
    }
#endif

/// The conversation transcript rendered by WKMarkdownKit's web engine:
/// turn folding, bare tool rows with animated detail wells, the
/// continuous-cursor fog reveal, two-layer code cards, grid tables,
/// in-flow plan approval, older-history paging — and the web
/// engine's native continuous text selection.
public struct WKConversationView {
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

    @MainActor
    fileprivate static func makeWebView(
        coordinator: Coordinator
    ) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(coordinator, name: "plan")
        configuration.userContentController.add(
            coordinator,
            name: "history"
        )
        let web = ChromelessWebView(
            frame: .zero,
            configuration: configuration
        )
        web.navigationDelegate = coordinator
        web.uiDelegate = coordinator
        #if os(macOS)
            web.setValue(false, forKey: "drawsBackground")
        #else
            web.isOpaque = false
            web.backgroundColor = .clear
            web.scrollView.backgroundColor = .clear
            // The page owns scrolling (#scroll); the document never
            // overflows, so the outer scroll view must not intercept
            // touches or rubber-band over the transcript.
            web.scrollView.isScrollEnabled = false
            web.scrollView.contentInsetAdjustmentBehavior = .never
            // Long-press link previews are a browser affordance; the
            // transcript opens links externally instead.
            web.allowsLinkPreview = false
        #endif
        if let resources = Bundle.module.url(
            forResource: "WebRoot",
            withExtension: nil
        ) {
            web.loadFileURL(
                resources.appendingPathComponent("page.html"),
                allowingReadAccessTo: resources
            )
        }
        coordinator.web = web
        return web
    }

    @MainActor
    fileprivate func apply(to coordinator: Coordinator) {
        coordinator.onPlanDecision = onPlanDecision
        coordinator.onLoadOlder = onLoadOlder
        coordinator.push(payload)
    }

    @MainActor
    public func makeCoordinator() -> Coordinator { Coordinator() }

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
        private var lastPayload: ConversationPayload?

        func push(_ payload: ConversationPayload) {
            // SwiftUI re-runs update on every geometry tick (inspector
            // open, window resize). Unchanged payloads must not
            // re-encode and re-cross the process boundary — the JS
            // fingerprint mask would drop them anyway, but only after
            // an XPC round-trip per animation frame.
            guard payload != lastPayload else { return }
            lastPayload = payload
            let data = (try? JSONEncoder().encode(payload))
                ?? Data(#"{"segments":[]}"#.utf8)
            let json = String(decoding: data, as: UTF8.self)
            guard ready else {
                pending = json
                return
            }
            web?.evaluateJavaScript("cog.update(\(json))")
        }

        private func openExternally(_ url: URL) {
            #if os(macOS)
                NSWorkspace.shared.open(url)
            #else
                UIApplication.shared.open(url)
            #endif
        }

        /// Links NEVER open inline — the transcript is not a
        /// browser. Only the page's own file:// load passes;
        /// everything else goes to the system handler.
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
            openExternally(url)
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
                openExternally(url)
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

#if os(macOS)
    extension WKConversationView: NSViewRepresentable {
        public func makeNSView(context: Context) -> WKWebView {
            Self.makeWebView(coordinator: context.coordinator)
        }

        public func updateNSView(_ web: WKWebView, context: Context) {
            apply(to: context.coordinator)
        }
    }
#else
    extension WKConversationView: UIViewRepresentable {
        public func makeUIView(context: Context) -> WKWebView {
            Self.makeWebView(coordinator: context.coordinator)
        }

        public func updateUIView(_ web: WKWebView, context: Context) {
            apply(to: context.coordinator)
        }
    }
#endif
