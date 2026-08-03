# WKMarkdownKit

A WKWebView-based streaming markdown / conversation renderer for
Apple platforms.

Born inside [Cog] as the web-renderer experiment for its conversation
panel; on 2026-08-03 it became the panel's main line, with an
app-agnostic API and zero host-app types. Open-sourced at
[lcandy2/WKMarkdownKit] — development currently happens in the Cog
monorepo and is synced here. A single-document core view
(**WKMarkdownView**) is planned as the conversation layer splits from
the markdown engine.

**Status**: macOS today (`WKConversationView` is AppKit-hosted); the
iOS branch is pending. Requires Swift 6.

## What it does

- **Streaming reveal**: a continuous cursor at a fixed 40 chars/s
  drives a spatial two-layer fog (blurred ghost ahead, sharp glyph
  fading in over it), with paragraph fast-forward, honest parking on
  stalls, and a low-passed reveal-height clip — no layout jumps.
- **Streaming-safe parsing**: [remend] repairs half-open markdown
  before [marked] parses; blocks are cached by source (lexer-level),
  so settled content is never re-rendered.
- **Native-grade selection**: continuous cross-block text selection
  with glyph-hugging highlights — all-flex structure (no WebKit
  selection-gap painting), grid tables, per-line code blocks,
  generated-content list markers, select-none chrome.
- **Conversation chrome**: turn folding ("Worked for Xs"), bare tool
  rows with animated 13px detail wells, in-flow plan approval cards,
  older-history paging with scroll anchoring, Working… row.
- **Code blocks**: two-layer card, hover chip (language + copy with
  stroke-draw confirmation), [highlight.js] syntax colors.

## API sketch

```swift
import WKMarkdownKit

WKConversationView(
    payload: ConversationPayload(segments: [...]),
    onPlanDecision: { requestId, decision in ... },
    onLoadOlder: { ... }
)
```

`ConversationPayload` is WKMarkdownKit's own schema — hosts map their
domain types into it; the renderer knows nothing about them.

## Vendored web dependencies

| Dependency | Version | License |
|---|---|---|
| [marked] | 15.x | MIT |
| [highlight.js] | 11.11.1 (+ xcode theme) | BSD-3-Clause |
| [remend] | 1.3.0 | MIT |

## License

MIT — see [LICENSE](LICENSE). Vendored dependencies keep their own
licenses (table above).

[Cog]: https://github.com/lcandy2
[lcandy2/WKMarkdownKit]: https://github.com/lcandy2/WKMarkdownKit
[marked]: https://github.com/markedjs/marked
[highlight.js]: https://github.com/highlightjs/highlight.js
[remend]: https://www.npmjs.com/package/remend
