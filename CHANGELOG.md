# Changelog

## [1.2.0] - 2026-05-12

링크 그래프 시각화. v1.1.0에서 만든 인덱스를 대시보드 미니 그래프로 노출 — 문서 의존성을 한눈에 본다. 뷰어 한도/안정화 + 마크다운 소프트 줄바꿈 + 라이선스 전환.

### Added
- Dashboard markdown link graph — interactive force-directed graph of md↔md links; root files anchor left, deeper docs push right via depth-weighted forceX; click node to open
- Rust command `get_graph_data` — returns nodes + edges with depth and orphan flags (200-node cap), shares `is_orphan_inner` with the Orphan Docs panel so both views stay consistent
- Loading indicator on first file reads (centered "loading…"); OS cache hits remain instant

### Changed
- File / diff size cap raised 1MB → 2MB
- Files larger than 1MB fall back to plain virtualized rows — prism tokenizes synchronously and would freeze the UI
- Link graph excludes docs with neither incoming nor outgoing md links — already surfaced in the Orphan Docs panel; removes duplication and keeps fit-to-viewport sane
- Graph wheel-zoom requires an explicit click first (was hijacking page scroll); Esc or cursor-leave releases. Subtle inset outline + top-right hint label marks the active state
- Per-node collide radius computed from label width so labels no longer overlap neighbors
- Markdown soft line wrap — single newlines render as `<br>` via remark-breaks, matching Obsidian / GitHub conventions
- License: MIT → Mozilla Public License 2.0 (file-level copyleft; combining MPL files into a Larger Work with other-licensed code remains allowed)

## [1.1.0] - 2026-04-20

마크다운 1급 시민화 — 문서 간 링크 그래프를 중심으로 편집기가 구조를 이해한다.

### Added
- Link graph infrastructure — background-built project-wide markdown index, watcher-driven incremental updates, `link-index-ready` event
- Internal link navigation — `[text](./foo.md)` opens in the viewer; external URLs open via OS (scheme whitelist: http/https/mailto/tel); `↗` icon marks external links
- Backlinks panel — collapsible "Referenced by" section under each markdown file with source path, line, and snippet
- Broken link detection — red dotted underline + native tooltip for broken inline links; dashed placeholder box for broken images
- Dashboard "Broken Links" section — source:line + link kind + broken href, click-to-open (hidden when empty)
- Dashboard "Orphan Docs" section — markdown files referenced nowhere (hidden when empty)
- File-view history — back/forward buttons and `⌘[` / `⌘]` / `⌘←` / `⌘→` shortcuts to retrace link-driven navigation
- Per-entry scroll memory — revisiting a file via back/forward restores its last scroll position; Esc back to dashboard clears history

### Branding
- Cool-shift palette — neutral chroma reduced to visually separate from warm cream/coral palettes. Rust accent (`#C85A2A` / `#E8703A`) retained as brand signature.
- `vibe.` logo mark — Instrument Serif italic `vibe` with an accent-colored period. Applied to window title, dashboard header, About modal, splash.
- New app icon — `v.` monogram (Instrument Serif italic `v` + rust dot). Regenerated full macOS / Windows / iOS / Android icon set via `tauri icon`.
- SVG favicon at `client/public/vibe-mark.svg`.

## [1.0.2] - 2026-04-18

### Added
- In-viewer search (Ctrl+F) — code and markdown, with highlight and navigation
- Copy All button — copies full file content to clipboard (works with virtualized viewer)
- Word wrap toggle in edit mode (Ctrl+W)
- Dashboard document pinning — pin frequently used docs to the top
- About modal (`?` key) — app version and git badge color legend
- 5-color git badges — distinct colors for added/untracked/modified/deleted/renamed
- Document description extraction — shows first paragraph preview in dashboard

### Fixed
- Gitignored files incorrectly showing git badges in the explorer
- About modal version hardcoded to 1.0.1 — now reads dynamically from Tauri API
- Scroll position reset when switching from view mode to edit mode

### Changed
- Design system alignment (sidebar 220px, border-radius, warm black shadows)

## [1.0.1] - 2026-04-10

### Added
- Space/Shift+Space page scroll in viewer
- Project name in title bar
- Absolute path drag and copy
- Collapsible document groups in dashboard

### Fixed
- Dashboard data accuracy and auto/manual refresh
- External file change detection in edit mode (ref-based comparison)
- Line number scroll sync in edit mode

## [1.0.0] - 2026-04-09

### Added
- File explorer (tree, keyboard navigation, create/delete/rename)
- Markdown viewer with edit and preview toggle
- Code viewer with syntax highlighting (react-window virtualization)
- Git diff (inline/side-by-side) + per-file status badges + auto-refresh
- Project dashboard (language breakdown, document list, recently changed)
- Multi-project switching (Cmd+1-9)
- File watching + auto-refresh
- GitHub Actions CI/CD (tag push → automated build and release)
