import Foundation

/// WKMarkdownKit's own input schema — deliberately free of any host-app
/// types. The consumer maps its domain (timeline items, approval
/// requests, …) into these rows; the renderer never learns where they
/// came from.
public struct ConversationPayload: Codable, Equatable, Sendable {
    public var segments: [Segment]
    public var hasMoreOlder: Bool
    public var working: Bool
    public var plan: PlanRequest?

    public init(
        segments: [Segment] = [],
        hasMoreOlder: Bool = false,
        working: Bool = false,
        plan: PlanRequest? = nil
    ) {
        self.segments = segments
        self.hasMoreOlder = hasMoreOlder
        self.working = working
        self.plan = plan
    }

    /// One turn: the user prompt(s), the working process (tools,
    /// thoughts), and the conclusion. Settled turns fold behind
    /// `workedLabel`.
    public struct Segment: Codable, Equatable, Sendable {
        public var id: String
        public var isLive: Bool
        public var workedLabel: String?
        public var user: [Row]
        public var process: [Row]
        public var conclusion: [Row]

        public init(
            id: String,
            isLive: Bool = false,
            workedLabel: String? = nil,
            user: [Row] = [],
            process: [Row] = [],
            conclusion: [Row] = []
        ) {
            self.id = id
            self.isLive = isLive
            self.workedLabel = workedLabel
            self.user = user
            self.process = process
            self.conclusion = conclusion
        }
    }

    /// One rendered row. `kind` follows the page's vocabulary:
    /// "user" | "assistant" | "thought" | "tool" | anything else
    /// renders as an assistant-style markdown body.
    public struct Row: Codable, Equatable, Sendable {
        public var id: String
        public var kind: String
        public var text: String
        public var streaming: Bool
        public var title: String?
        public var status: String?
        public var output: String?
        public var symbol: String?
        /// Shell invocation rendered under a `$` prefix.
        public var invocation: String?
        /// Small label at the top of the detail well ("Shell", "json").
        public var kindLabel: String?
        /// Secondary fact beside the label ("12 lines", "2 files").
        public var detail: String?
        public var truncated: Bool

        public init(
            id: String,
            kind: String,
            text: String = "",
            streaming: Bool = false,
            title: String? = nil,
            status: String? = nil,
            output: String? = nil,
            symbol: String? = nil,
            invocation: String? = nil,
            kindLabel: String? = nil,
            detail: String? = nil,
            truncated: Bool = false
        ) {
            self.id = id
            self.kind = kind
            self.text = text
            self.streaming = streaming
            self.title = title
            self.status = status
            self.output = output
            self.symbol = symbol
            self.invocation = invocation
            self.kindLabel = kindLabel
            self.detail = detail
            self.truncated = truncated
        }
    }

    /// An in-flow approval card asking for a plan decision.
    public struct PlanRequest: Codable, Equatable, Sendable {
        public var id: String
        public var content: String?

        public init(id: String, content: String? = nil) {
            self.id = id
            self.content = content
        }
    }
}

/// The decision the plan card sends back.
public enum PlanCardDecision: Equatable, Sendable {
    case approved
    case abandoned
    case cancelled(feedback: String?)
}
