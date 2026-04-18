# Changelog

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
