# Changelog

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
