"use strict";

const column = document.getElementById("column");
const scrollEl = document.getElementById("scroll");
let autoScroll = true;
let historyInFlight = false;

scrollEl.addEventListener("scroll", () => {
    const dist = scrollEl.scrollHeight - scrollEl.scrollTop
        - scrollEl.clientHeight;
    autoScroll = dist < 80;
    maybeRequestOlder();
}, { passive: true });

function maybeRequestOlder() {
    const sentinel = document.getElementById("older-sentinel");
    if (!sentinel || historyInFlight) { return; }
    if (sentinel.getBoundingClientRect().bottom >= 0
        && scrollEl.scrollTop < 200) {
        historyInFlight = true;
        window.webkit?.messageHandlers?.history
            ?.postMessage({});
    }
}

function scrollToBottom(force) {
    if (!force && !autoScroll) { return; }
    scrollEl.scrollTop = scrollEl.scrollHeight;
}

function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function mdToHtml(md) {
    if (!window.marked) {
        return "<p>" + esc(md).replace(/\n/g, "<br>") + "</p>";
    }
    return marked.parse(md, { gfm: true, breaks: false });
}

/// Streaming-tolerant repair before parsing: remend fixes
/// half-open fences/emphasis/links so
/// nothing renders as literal syntax and then jumps.
/// Fallback: fence auto-close only.
function repairMarkdown(md) {
    if (window.remend) {
        try { return remend(md); } catch (_) {}
    }
    let closed = md;
    const fences = (md.match(/^\s*```/gm) || []).length;
    if (fences % 2 === 1) { closed += "\n```"; }
    return closed;
}

function mdToHtmlStreaming(md) {
    return mdToHtml(repairMarkdown(md));
}

const COPY_SVG = '<svg viewBox="0 0 16 16" fill="none" stroke-width="1.4"><rect x="5" y="5" width="8" height="9" rx="2"/><path d="M11 5V4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1"/></svg>';
const CHECK_SVG = '<svg class="check" viewBox="0 0 16 16" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5 6.5 12 13 4.5"/></svg>';

/// Native tool symbols (ToolCardPresentation.symbol) as
/// 16×16 stroke equivalents. Unknown → wrench (generic).
const TOOL_ICONS = {
    "terminal": '<rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="m4.5 6 2 2-2 2M8.5 10.5h3"/>',
    "doc.text": '<path d="M4 1.5h5l3 3v10H4z"/><path d="M9 1.5v3h3M6 8h4M6 10.5h4"/>',
    "doc.badge.plus": '<path d="M4 1.5h5l3 3v10H4z"/><path d="M9 1.5v3h3M8 8v4M6 10h4"/>',
    "pencil.and.scribble": '<path d="m9.5 2.5 4 4L6 14l-4.5 1L2.5 10zM2 15.5c2-1 3 .5 5 0"/>',
    "magnifyingglass": '<circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3.5 3.5"/>',
    "folder": '<path d="M1.5 4a1.5 1.5 0 0 1 1.5-1.5h3l1.5 2h5A1.5 1.5 0 0 1 14 6v6a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12z"/>',
    "point.3.connected.trianglepath.dotted": '<circle cx="8" cy="3.5" r="1.5"/><circle cx="3.5" cy="12" r="1.5"/><circle cx="12.5" cy="12" r="1.5"/><path stroke-dasharray="2 2" d="M7 5 4.5 10.5M9 5l2.5 5.5M5 12.5h6"/>',
    "person.2": '<circle cx="5.5" cy="6" r="2.5"/><path d="M1.5 14a4 4 0 0 1 8 0"/><circle cx="11.5" cy="6" r="2"/><path d="M10.5 9.7a4 4 0 0 1 4 3.8"/>',
    "checklist": '<path d="m2 4 1.2 1.2L5.5 3M2 9l1.2 1.2L5.5 8M2 14l1.2 1.2L5.5 13M8 4.5h6M8 9.5h6M8 14.5h6"/>',
    "list.bullet.clipboard": '<rect x="3" y="2.5" width="10" height="12" rx="1.5"/><path d="M6 1.5h4v2H6zM6 7h4.5M6 10h4.5"/>',
    "scope": '<circle cx="8" cy="8" r="5"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/>',
    "wrench.and.screwdriver": '<path d="M9.5 6.5 13 3a3.5 3.5 0 0 1-4.7 4.6L4 11.9V14H2v-2.5l4.4-4.4A3.5 3.5 0 0 1 9.5 6.5z"/>',
};

function toolIcon(symbol) {
    const paths = TOOL_ICONS[symbol]
        || TOOL_ICONS["wrench.and.screwdriver"];
    return '<svg class="ticon" viewBox="0 0 16 16"'
        + ' fill="none" stroke="currentColor"'
        + ' stroke-width="1.3" stroke-linecap="round"'
        + ' stroke-linejoin="round">' + paths + "</svg>";
}

/// Native rule: icon only for known languages.
function langIcon(lang) {
    switch (lang) {
    case "sh": case "bash": case "zsh": case "shell":
    case "console":
        return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="m4.5 6 2 2-2 2M8.5 10.5h3"/></svg>';
    case "json":
        return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 2.5c-1.5 0-2 .8-2 2v1.6c0 .9-.6 1.4-1.5 1.4.9 0 1.5.5 1.5 1.4V11.5c0 1.2.5 2 2 2M10 2.5c1.5 0 2 .8 2 2v1.6c0 .9.6 1.4 1.5 1.4-.9 0-1.5.5-1.5 1.4V11.5c0 1.2-.5 2-2 2"/></svg>';
    default:
        return null;
    }
}

/// Rebuild marked's generic pre/code into the NATIVE
/// two-layer card + hover chip.
/// marked emits pretty-printed HTML: newline text nodes sit
/// between every block tag. Inside tables the parser
/// foster-parents them OUT of the table (the phantom
/// selected slivers at row ends); elsewhere they join the
/// selection as invisible gaps. React never emits them —
/// neither do we, after this sweep.
function stripStrayWhitespace(root) {
    const containers = new Set([
        "DIV", "TABLE", "THEAD", "TBODY", "TR",
        "UL", "OL", "BLOCKQUOTE", "PRE",
    ]);
    const walker = document.createTreeWalker(
        root, NodeFilter.SHOW_TEXT
    );
    const doomed = [];
    let node;
    while ((node = walker.nextNode())) {
        if (/\S/.test(node.textContent)) { continue; }
        const parent = node.parentElement;
        if (parent && containers.has(parent.tagName)) {
            doomed.push(node);
        }
    }
    for (const stray of doomed) { stray.remove(); }
}

function upgradeMarkdownDOM(root) {
    stripStrayWhitespace(root);
    // Each li's contiguous inline run moves into a .li-run block:
    // the li itself is flex-column (no selection gap painting), and
    // a real block child keeps inline runs on one line — bare flex
    // items would split text and <strong> onto separate rows.
    const LI_BLOCKS = new Set([
        "UL", "OL", "P", "PRE", "BLOCKQUOTE", "TABLE", "DIV",
    ]);
    for (const li of root.querySelectorAll("li")) {
        let run = null;
        for (const node of [...li.childNodes]) {
            const isBlock = node.nodeType === 1
                && LI_BLOCKS.has(node.tagName);
            if (isBlock) { run = null; continue; }
            // Whitespace at a block boundary would open an EMPTY run
            // (one line-height of phantom space + a flex gap);
            // whitespace INSIDE a run stays — it's word spacing.
            if (!run && node.nodeType === 3
                && !/\S/.test(node.textContent)) {
                node.remove();
                continue;
            }
            if (!run) {
                run = document.createElement("div");
                run.className = "li-run";
                li.insertBefore(run, node);
            }
            run.append(node);
        }
    }
    for (const pre of [...root.querySelectorAll("pre")]) {
        if (pre.closest(".codewrap")) { continue; }
        const code = pre.querySelector("code");
        const langClass = code
            && [...code.classList].find(
                c => c.startsWith("language-")
            );
        const lang = langClass ? langClass.slice(9) : "";
        const wrap = document.createElement("div");
        wrap.className = "codewrap";
        const card = document.createElement("div");
        card.className = "codecard";
        const surface = document.createElement("div");
        surface.className = "codesurface";
        pre.replaceWith(wrap);
        surface.append(pre);
        card.append(surface);
        wrap.append(card);
        const icon = langIcon(lang.toLowerCase());
        const label = lang
            ? '<span class="lang">' + esc(lang) + "</span>"
            : "";
        const chip = document.createElement("div");
        chip.className = "chip";
        chip.innerHTML = (icon || "") + label
            + '<button title="Copy" aria-label="Copy code"'
            + ' onclick="copyCode(this)">'
            + COPY_SVG + "</button>";
        wrap.append(chip);
        if (window.hljs && code
            && !code.dataset.highlighted) {
            try { hljs.highlightElement(code); } catch (_) {}
        }
        if (code) { splitCodeLines(code); }
    }
    // Cells are select-none shells; their text moves into
    // selectable .cellsel spans so only glyphs highlight.
    for (const cell of root.querySelectorAll("td, th")) {
        if (cell.querySelector(":scope > .cellsel")) {
            continue;
        }
        const span = document.createElement("span");
        span.className = "cellsel";
        while (cell.firstChild) {
            span.append(cell.firstChild);
        }
        cell.append(span);
    }
    // Grid tracks: one auto column per table column.
    for (const table of root.querySelectorAll("table")) {
        let columns = 0;
        for (const row of table.querySelectorAll("tr")) {
            columns = Math.max(
                columns, row.children.length
            );
        }
        if (columns > 0) {
            table.style.gridTemplateColumns =
                "repeat(" + columns + ", auto)";
        }
    }
}

/// Rewrap highlighted code so every LINE is a block-level
/// .cl hugging its own text (per-line selection bounds).
/// Tokens spanning newlines are re-cloned per segment.
function splitCodeLines(code) {
    if (code.querySelector(".cl")) { return; }
    const lines = [[]];
    const push = (node) => {
        const text = node.textContent;
        if (!text.includes("\n")) {
            lines[lines.length - 1]
                .push(node.cloneNode(true));
            return;
        }
        text.split("\n").forEach((part, index) => {
            if (index > 0) { lines.push([]); }
            if (part === "") { return; }
            if (node.nodeType === Node.TEXT_NODE) {
                lines[lines.length - 1].push(
                    document.createTextNode(part)
                );
            } else {
                const el = node.cloneNode(false);
                el.textContent = part;
                lines[lines.length - 1].push(el);
            }
        });
    };
    [...code.childNodes].forEach(push);
    // Drop a single trailing empty line (the fence's own
    // newline) — faithful to the native renderer.
    if (lines.length > 1
        && lines[lines.length - 1].length === 0) {
        lines.pop();
    }
    code.textContent = "";
    for (const nodes of lines) {
        const line = document.createElement("div");
        line.className = "cl";
        if (nodes.length === 0) {
            line.append(document.createElement("br"));
        } else {
            for (const node of nodes) {
                line.append(node);
            }
        }
        code.append(line);
    }
}

function copyCode(button) {
    const wrap = button.closest(".codewrap");
    const code = wrap.querySelector("code").innerText;
    navigator.clipboard.writeText(code);
    const chip = wrap.querySelector(".chip");
    button.innerHTML = CHECK_SVG;
    chip.classList.add("copied");
    setTimeout(() => {
        chip.classList.remove("copied");
        button.innerHTML = COPY_SVG;
    }, 1800);
}

// ---- fog reveal: NATIVE MODEL port ---------------------
// The native engine's shape, verbatim: a CONTINUOUS cursor
// advancing at a fixed 40 chars/s every display frame, and
// a SPATIAL trail — each glyph's opacity/blur is a function
// of its distance to the cursor, a gradient sweeping the
// text. Spans are created once per content change with no
// CSS animation; between chunks each frame only writes
// styles on the ~6 spans inside the cursor window. No
// re-layout between chunks, 120Hz-smooth, strictly linear.
// Speed calibration: the cursor lives in FULL character
// space (whitespace included — native's `revealed` is a
// plain char offset), so 40 chars/s here IS native's
// 40 chars/s. Trail/lead match the native ramp (9/4).
const CPS = 40;
const TRAIL_CHARS = 9;    // native trailWidth
const LEAD_CHARS = 4;     // native leadWidth
const FOG_BLUR_PX = 1.5;
/// item id -> {cursor, done, lastTs, spans: [{el, ci}],
///             chips: [{el, startCi, endCi, complete}],
///             totalChars, blockStarts}
const reveals = new Map();
let revealRaf = null;

function ensureRevealLoop() {
    if (revealRaf === null) {
        revealRaf = requestAnimationFrame(revealTick);
    }
}

function revealTick(ts) {
    revealRaf = null;
    for (const state of reveals.values()) {
        const dt = state.lastTs
            ? Math.min((ts - state.lastTs) / 1000, 0.1)
            : 0;
        state.lastTs = ts;
        state.dt = dt;
        if (state.cursor < state.totalChars) {
            // Fixed speed. Never adapts — parks honestly
            // when it catches up to the born chars, fog
            // frozen mid-ramp exactly like the native
            // stall policy.
            state.cursor = Math.min(
                state.totalChars,
                state.cursor + CPS * dt
            );
        }
        // Paint EVERY frame while streaming — the height
        // low-pass and the stick-to-bottom follow must keep
        // gliding even while the cursor parks, or scroll
        // and height fall out of step and the page bobs.
        paintReveal(state);
    }
    if (reveals.size > 0) {
        revealRaf = requestAnimationFrame(revealTick);
    }
}

function paintReveal(state) {
    const cursor = state.cursor;
    // Settle everything fully behind the trail; state.done
    // is an index into spans (sorted by ci).
    let i = state.done;
    while (i < state.spans.length
        && state.spans[i].ci <= cursor - TRAIL_CHARS) {
        settleSpan(state.spans[i].el);
        i += 1;
    }
    state.done = i;
    let edge = null;
    for (let j = i; j < state.spans.length; j++) {
        const entry = state.spans[j];
        if (entry.ci >= cursor + LEAD_CHARS) { break; }
        // Native's TWO-LAYER crossfade: a blurred ghost of
        // the glyph materializes AHEAD of the cursor (lead
        // ramp), the sharp glyph fades in over it (trail
        // ramp) while the ghost decays.
        const d = cursor - entry.ci;
        const sharp = Math.max(
            0, Math.min(1, d / TRAIL_CHARS)
        );
        const ghost = Math.max(
            0,
            Math.min(1, (d + LEAD_CHARS) / LEAD_CHARS)
        ) * (1 - sharp);
        entry.el.classList.add("fog-live");
        entry.el.style.setProperty(
            "--s", sharp.toFixed(3)
        );
        entry.el.style.setProperty(
            "--g", ghost.toFixed(3)
        );
        edge = entry.el;
    }
    paintChips(state);

    // Reveal-height: clip the body to the wavefront's line
    // bottom, low-passed (native heightTau 0.09), never
    // shrinking.
    if (state.body && state.spans.length > 0) {
        if (!edge && state.done > 0) {
            edge = state.spans[
                Math.min(
                    state.done, state.spans.length
                ) - 1
            ].el;
        }
        if (edge) {
            // Rect math, not offsetTop — the offsetParent
            // of code glyphs is the positioned codewrap,
            // which under-measured and clipped streaming
            // code blocks.
            let target = edge.getBoundingClientRect().bottom
                - state.body.getBoundingClientRect().top
                + 8;
            target = Math.max(target, state.h || 0);
            const dt = state.dt || 0;
            const k = dt > 0
                ? 1 - Math.exp(-dt / 0.09) : 1;
            state.h = state.h > 0
                ? state.h + (target - state.h) * k
                : target;
            state.body.style.height =
                Math.ceil(state.h) + "px";
            // Scroll follows the glide FRAME BY FRAME —
            // committing it only on chunk arrivals made the
            // page step while the height flowed.
            scrollToBottom();
        }
    }
}

/// (B) Inline-code chips sweep open with the cursor: the
/// mask fraction tracks revealed chars within the chip.
function paintChips(state) {
    for (const chip of state.chips) {
        if (chip.complete) { continue; }
        const span = chip.endCi - chip.startCi || 1;
        const rv = Math.max(
            0,
            Math.min(
                1,
                (state.cursor - chip.startCi
                    + LEAD_CHARS) / span
            )
        );
        chip.el.style.setProperty(
            "--rv", rv.toFixed(3)
        );
        if (rv >= 1) { chip.complete = true; }
    }
}

function settleSpan(span) {
    span.classList.remove("fog-live");
    span.classList.add("fog-done");
    span.style.removeProperty("--s");
    span.style.removeProperty("--g");
}

/// Wrap every character (code point) of the container in a
/// bare .fog span — transparent glyph reserving layout; the
/// cursor loop drives the ghost/sharp pseudo layers.
function fogBlock(container) {
    const walker = document.createTreeWalker(
        container, NodeFilter.SHOW_TEXT
    );
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
        // Chrome never fogs: the hover chip's language
        // label is UI, not content.
        if (node.parentElement?.closest(".fog, .chip")) {
            continue;
        }
        nodes.push(node);
    }
    for (const textNode of nodes) {
        const text = textNode.textContent;
        if (text.trim() === "") { continue; }
        const frag = document.createDocumentFragment();
        for (const char of [...text]) {
            if (/^\s+$/.test(char)) {
                frag.append(char);
                continue;
            }
            const span = document.createElement("span");
            span.className = "fog";
            span.textContent = char;
            span.dataset.ch = char;
            frag.append(span);
        }
        textNode.replaceWith(frag);
    }
}

// ---- item / segment rendering --------------------------
const expandedTurns = new Map();   // segment id -> bool
const expandedTools = new Map();   // tool item id -> bool

// Titles and fold labels are selectable, and their rows are
// click targets: a drag that just made a selection also fires
// click on mouseup, which would collapse the well AND discard
// the selection. A non-collapsed selection at click time means
// "the user was selecting, not clicking" — skip the toggle.
function clickWasDragSelect() {
    const sel = window.getSelection();
    return sel !== null && !sel.isCollapsed;
}

function toggleTool(itemId) {
    if (clickWasDragSelect()) { return; }
    expandedTools.set(
        itemId, expandedTools.get(itemId) !== true
    );
    document.getElementById("t-" + itemId)
        ?.classList.toggle(
            "expanded",
            expandedTools.get(itemId) === true
        );
}

function renderRow(item) {
    if (item.kind === "user") {
        return '<div class="userrow"><div class="userbubble">'
            + '<span class="ubtext">' + esc(item.text)
            + "</span></div></div>";
    }
    if (item.kind === "tool") {
        const failed = item.status === "failed";
        const running = item.status === "running";
        const cancelled = item.status === "cancelled";
        const expanded =
            expandedTools.get(item.id) === true;
        let well = "";
        if (item.kindLabel || item.detail) {
            well += '<div class="tool-label">'
                + esc(item.kindLabel || "")
                + (item.detail
                    ? '<span class="tool-detail"> · '
                        + esc(item.detail) + "</span>"
                    : "")
                + "</div>";
        }
        if (item.invocation) {
            well += '<div class="tool-invocation">'
                + '<span class="tprompt">$</span> '
                + esc(item.invocation) + "</div>";
        }
        if (item.output) {
            well += '<div class="tool-output">' + esc(item.output)
                + "</div>";
        }
        if (item.truncated) {
            well += '<div class="tool-truncated">'
                + "Output truncated for display</div>";
        }
        return '<div class="toolwrap'
            + (expanded ? " expanded" : "")
            + '" id="t-' + esc(item.id) + '">'
            + '<div class="toolrow'
            + (failed ? " failed" : "")
            + (running ? " running" : "")
            + '" onclick="toggleTool(\'' + esc(item.id)
            + "')\">"
            + toolIcon(item.symbol)
            + '<span class="ttitle">'
            + esc(item.title || item.text || "tool")
            + "</span>"
            + (failed ? '<span class="tfail">✕</span>' : "")
            + (cancelled ? '<span class="tcancel">−</span>' : "")
            + "</div>"
            + (well
                ? '<div class="toolbody-wrap">'
                    + '<div class="toolbody">' + well
                    + "</div></div>"
                : "")
            + "</div>";
    }
    const extra = item.kind === "thought" ? " thought" : "";
    if (item.streaming) {
        // Shell only — the smoother fills it block by block.
        return '<div class="md' + extra + '" data-item="'
            + esc(item.id) + '" data-streaming="true"></div>';
    }
    return '<div class="md' + extra + '" data-item="'
        + esc(item.id) + '" data-streaming="false">'
        + mdToHtml(item.text) + "</div>";
}

// ---- block-cached streaming body -----------------------
// marked.lexer splits the repaired markdown into top-level
// blocks; each renders into its own child div keyed by its
// raw source. Settled blocks are NEVER touched again — only
// the tail block re-renders per commit, so its fog spans
// are the only ones rebuilt (and they resume via negative
// delays).
function renderStreamingBody(body, itemId, text) {
    const repaired = repairMarkdown(text);
    const tokens = window.marked
        ? marked.lexer(repaired) : null;
    if (!tokens) {
        body.innerHTML = mdToHtml(repaired);
        upgradeMarkdownDOM(body);
        return;
    }
    let offset = 0;
    const blocks = tokens.map((token) => {
        const block = {
            raw: token.raw, start: offset,
        };
        offset += token.raw.length;
        return block;
    });
    const children = [...body.children];
    blocks.forEach((block, index) => {
        let child = children[index];
        if (child && child.dataset.src === block.raw) {
            return;
        }
        if (!child) {
            child = document.createElement("div");
            child.className = "blk";
            body.append(child);
        }
        child.dataset.src = block.raw;
        child.innerHTML = mdToHtml(block.raw);
        upgradeMarkdownDOM(child);
        fogBlock(child);
    });
    while (body.children.length > blocks.length) {
        body.lastElementChild.remove();
    }
}

// ---- streaming intake ----------------------------------
// The intake engineering (remend repair, block cache, ≥48ms
// rebuild throttle) feeds the display model (the
// continuous cursor above). Chunk arrival rebuilds only
// changed blocks with the FULL text; the cursor owns all
// pacing. Paragraph completions fast-forward the cursor —
// the native policy: fixed speed, never adapt, but a
// finished paragraph snaps past with a quick stagger.
const smoothers = new Map();  // item id -> intake state

function smootherSetTarget(itemId, text) {
    let s = smoothers.get(itemId);
    if (!s) {
        s = { lastRebuild: 0, pending: null, text: "" };
        smoothers.set(itemId, s);
    }
    if (text === s.text) { return; }
    const now = performance.now();
    if (now - s.lastRebuild < 48) {
        if (s.pending === null) {
            setTimeout(() => {
                // The item may have settled while queued.
                if (!smoothers.has(itemId)) { return; }
                const queued = s.pending;
                s.pending = null;
                if (queued !== null) {
                    smootherSetTarget(itemId, queued);
                }
            }, 48 - (now - s.lastRebuild));
        }
        s.pending = text;
        return;
    }
    s.lastRebuild = now;
    const previous = s.text;
    s.text = text;
    commitStreaming(itemId, text, previous);
}

/// A segment rebuild (fingerprint change: rows appended, status
/// flipped) replaces every streaming body with an EMPTY shell.
/// The dedupe in smootherSetTarget would skip the refill — the
/// text has not changed — leaving completed-but-still-streaming
/// rows permanently blank. Force the commit; the reveal state
/// keeps its cursor, so the fog resumes in place.
function smootherRefill(itemId, text) {
    let s = smoothers.get(itemId);
    if (!s) {
        s = { lastRebuild: 0, pending: null, text: "" };
        smoothers.set(itemId, s);
    }
    s.lastRebuild = performance.now();
    s.pending = null;
    const previous = s.text;
    s.text = text;
    commitStreaming(itemId, text, previous);
}

function commitStreaming(itemId, text, previous) {
    const body = document.querySelector(
        '[data-item="' + CSS.escape(itemId)
        + '"][data-streaming="true"]'
    );
    if (!body) { return; }
    renderStreamingBody(body, itemId, text);

    const fresh = !reveals.has(itemId);
    let state = reveals.get(itemId);
    if (!state) {
        state = {
            blockStarts: [], chips: [], cursor: 0,
            done: 0, dt: 0, h: 0, lastTs: 0,
            spans: [], totalChars: 0, text: "",
        };
        reveals.set(itemId, state);
    }
    state.body = body;

    // Re-collect in CHAR SPACE: every rendered character
    // (whitespace included) advances the count; fog spans
    // record their absolute index — the cursor paces over
    // text exactly like the native `revealed` offset.
    const spans = [];
    const chipIndex = new Map();
    const chips = [];
    const blockStarts = [];
    let chars = 0;
    for (const block of body.children) {
        blockStarts.push(chars);
        const walker = document.createTreeWalker(
            block, NodeFilter.SHOW_TEXT
        );
        let node;
        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (parent?.closest(".chip")) { continue; }
            if (parent?.classList.contains("fog")) {
                spans.push({ ci: chars, el: parent });
                const codeEl = parent.closest("code");
                if (codeEl && !codeEl.closest("pre")) {
                    let chip = chipIndex.get(codeEl);
                    if (!chip) {
                        chip = {
                            complete: false,
                            el: codeEl,
                            endCi: chars,
                            startCi: chars,
                        };
                        chipIndex.set(codeEl, chip);
                        chips.push(chip);
                    }
                    chip.endCi = chars + 1;
                }
            }
            chars += [...node.textContent].length;
        }
    }
    state.spans = spans;
    state.chips = chips;
    state.blockStarts = blockStarts;
    state.totalChars = chars;

    // Mid-turn open: reveal existing content instantly,
    // sweep only what arrives from here (native's
    // first-content skip).
    if (fresh && chars > 300) {
        state.cursor = chars;
    }

    // Settle behind the cursor, repaint the window, and
    // seed every chip's mask synchronously — no frame may
    // render with defaults after a rebuild.
    state.done = 0;
    paintReveal(state);

    // Paragraph fast-forward (native policy): completed
    // BLOCKS behind the tail snap past with a brief
    // stagger; the tail block sweeps at cruise speed.
    if (blockStarts.length > 1) {
        const target =
            blockStarts[blockStarts.length - 1];
        if (target > state.cursor) {
            let staggerIndex = 0;
            for (const entry of spans) {
                if (entry.ci < state.cursor) { continue; }
                if (entry.ci >= target) { break; }
                entry.el.classList.add("fog-ff");
                entry.el.style.animationDelay =
                    Math.min(250, staggerIndex * 4)
                    + "ms";
                staggerIndex += 1;
            }
            state.cursor = target;
            paintReveal(state);
        }
    }
    state.text = text;
    ensureRevealLoop();
    scrollToBottom();
}

function dropStreamingState(itemId) {
    smoothers.delete(itemId);
    reveals.delete(itemId);
    if (reveals.size === 0 && revealRaf !== null) {
        cancelAnimationFrame(revealRaf);
        revealRaf = null;
    }
}

function renderSegment(seg) {
    let html = "";
    for (const item of seg.user) {
        html += renderRow(item);
    }
    const hasProcess = seg.process.length > 0;
    if (hasProcess && !seg.isLive) {
        const expanded = expandedTurns.get(seg.id) === true;
        html += '<div class="fold'
            + (expanded ? " expanded" : "")
            + '" onclick="toggleFold(\'' + esc(seg.id)
            + '\')"><span class="fold-label">'
            + esc(seg.workedLabel || "Worked")
            + '</span><span class="chev">›</span></div>';
        html += '<div class="process-shell'
            + (expanded ? " expanded" : "")
            + '"><div class="process-clip"><div class="process">';
    } else if (hasProcess) {
        html += '<div class="process">';
    }
    if (hasProcess) {
        for (const item of seg.process) {
            html += renderRow(item);
        }
        html += seg.isLive
            ? "</div>" : "</div></div></div>";
    }
    for (const item of seg.conclusion) {
        html += renderRow(item);
    }
    return html;
}

function toggleFold(segId) {
    if (clickWasDragSelect()) { return; }
    expandedTurns.set(
        segId, expandedTurns.get(segId) !== true
    );
    const el = document.getElementById("s-" + segId);
    if (!el) { return; }
    const fold = el.querySelector(".fold");
    const shell = el.querySelector(".process-shell");
    const expanded = expandedTurns.get(segId) === true;
    fold?.classList.toggle("expanded", expanded);
    shell?.classList.toggle("expanded", expanded);
}

// ---- plan approval (native card, in flow) --------------
let planFeedbackMode = false;
let currentPlanId = null;

function renderPlan(plan) {
    let actions;
    if (planFeedbackMode) {
        actions =
            '<input type="text" id="plan-feedback"'
            + ' placeholder="What should change?">'
            + '<div class="actions">'
            + '<button class="pbtn prominent"'
            + " onclick=\"planDecide('cancelled')\">"
            + "Send Feedback</button>"
            + '<button class="pbtn"'
            + ' onclick="planBack()">Back</button></div>';
    } else {
        actions = '<div class="actions">'
            + '<button class="pbtn prominent"'
            + " onclick=\"planDecide('approved')\">"
            + "Approve</button>"
            + '<button class="pbtn"'
            + ' onclick="planChanges()">'
            + "Request Changes</button>"
            + '<button class="pbtn destructive"'
            + " onclick=\"planDecide('abandoned')\">"
            + "Abandon</button></div>";
    }
    return '<div class="plancard">'
        + '<div class="caption">Plan Approval</div>'
        + (plan.content
            ? '<div class="content md">'
                + mdToHtml(plan.content) + "</div>"
            : "")
        + actions + "</div>";
}

function planChanges() {
    planFeedbackMode = true;
    rerenderPlan();
}
function planBack() {
    planFeedbackMode = false;
    rerenderPlan();
}
function planDecide(decision) {
    const feedback =
        document.getElementById("plan-feedback")?.value
        ?? null;
    window.webkit?.messageHandlers?.plan?.postMessage({
        requestId: currentPlanId,
        decision,
        feedback: decision === "cancelled" ? feedback : null,
    });
}
function rerenderPlan() {
    const host = document.getElementById("plan-host");
    if (host && window.lastPlan) {
        host.innerHTML = renderPlan(window.lastPlan);
        upgradeMarkdownDOM(host);
    }
}

// ---- reconcile -----------------------------------------
window.cog = {
    update(payload) {
        const firstId = column.querySelector(".seg")?.id;
        const anchor = firstId
            && document.getElementById(firstId);
        const anchorTop =
            anchor?.getBoundingClientRect().top;

        // Older-history sentinel keeps its slot at the top.
        let sentinel =
            document.getElementById("older-sentinel");
        if (payload.hasMoreOlder && !sentinel) {
            sentinel = document.createElement("div");
            sentinel.id = "older-sentinel";
            sentinel.textContent =
                "Loading earlier history…";
            column.prepend(sentinel);
        } else if (!payload.hasMoreOlder && sentinel) {
            sentinel.remove();
            sentinel = null;
        }

        const live = new Set();
        let previous = sentinel;
        for (const seg of payload.segments) {
            live.add("s-" + seg.id);
            let el = document.getElementById("s-" + seg.id);
            // Streaming text is MASKED out of the shell
            // fingerprint — chunk arrivals must not rebuild
            // the segment; the smoother owns those bodies.
            const mask = (row) => row.streaming
                ? { ...row, text: "~live~" } : row;
            const fingerprint = JSON.stringify({
                ...seg,
                conclusion: seg.conclusion.map(mask),
                process: seg.process.map(mask),
            });
            if (!el) {
                el = document.createElement("div");
                el.id = "s-" + seg.id;
                el.className = "seg";
                if (previous) {
                    previous.after(el);
                } else {
                    column.prepend(el);
                }
            }
            let rebuilt = false;
            if (el.dataset.fp !== fingerprint) {
                el.dataset.fp = fingerprint;
                el.innerHTML = renderSegment(seg);
                upgradeMarkdownDOM(el);
                rebuilt = true;
            }
            for (const row of [
                ...seg.process, ...seg.conclusion,
            ]) {
                if (row.streaming) {
                    if (rebuilt) {
                        smootherRefill(row.id, row.text);
                    } else {
                        smootherSetTarget(row.id, row.text);
                    }
                } else if (smoothers.has(row.id)) {
                    dropStreamingState(row.id);
                }
            }
            previous = el;
        }
        for (const el of [
            ...column.querySelectorAll(".seg"),
        ]) {
            if (!live.has(el.id)) { el.remove(); }
        }

        // Working… row, native rule.
        let workingEl =
            document.getElementById("working-row");
        if (payload.working && !workingEl) {
            workingEl = document.createElement("div");
            workingEl.id = "working-row";
            workingEl.className = "working shimmer";
            workingEl.textContent = "Working…";
            column.append(workingEl);
        } else if (!payload.working && workingEl) {
            workingEl.remove();
        } else if (workingEl) {
            column.append(workingEl);
        }

        // Plan approval card rides the end of the flow.
        let planHost =
            document.getElementById("plan-host");
        if (payload.plan) {
            window.lastPlan = payload.plan;
            if (currentPlanId !== payload.plan.id) {
                currentPlanId = payload.plan.id;
                planFeedbackMode = false;
                planHost?.remove();
                planHost = null;
            }
            if (!planHost) {
                planHost = document.createElement("div");
                planHost.id = "plan-host";
                planHost.innerHTML =
                    renderPlan(payload.plan);
                upgradeMarkdownDOM(planHost);
            }
            column.append(planHost);
        } else if (planHost) {
            planHost.remove();
            currentPlanId = null;
            planFeedbackMode = false;
        }

        // Prepend anchoring: keep the viewport still when
        // older history lands above it.
        if (anchor && document.contains(anchor)
            && anchorTop !== undefined) {
            const shift =
                anchor.getBoundingClientRect().top
                - anchorTop;
            if (Math.abs(shift) > 1) {
                scrollEl.scrollTop += shift;
            }
            if (column.querySelector(".seg")?.id
                !== firstId) {
                historyInFlight = false;
            }
        } else {
            historyInFlight = false;
        }

        scrollToBottom();
    },
};
