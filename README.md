# vibe

A lightweight, always-on window to see what AI builds.

**vibe .** That's all you need.

[한국어 설명 (Korean README)](./README.ko.md)

## What is Vibe?

When coding with AI CLIs (Claude Code, etc.), you need `cat`, `vim`, or a heavy IDE just to check the output. Vibe solves this.

- **Always on** — Auto-refreshes when AI changes files. Zero context-switching cost.
- **Viewing is the point** — Markdown rendering, syntax highlighting, one click to check.
- **Light and fast** — Tauri native app. ~2MB DMG. Instant launch.

## Installation

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)

### Build from source

```bash
git clone https://github.com/solpop-arch/vibe.git
cd vibe
cd client && npm install && cd ..
npx @tauri-apps/cli@^2 build
```

The built app is generated at `src-tauri/target/release/bundle/`.

### Development

```bash
npx @tauri-apps/cli@^2 dev
```

## Usage

```bash
# Open a specific project folder
vibe /path/to/project

# Open current directory
vibe .

# No argument → folder picker dialog
vibe
```

## Features

| Feature | Description |
|---|---|
| **File Explorer** | Project file tree browsing with keyboard navigation |
| **File Viewer** | Markdown rendering, syntax highlighting, line numbers |
| **File Editing** | Inline edit mode, Ctrl+S to save |
| **File Watching** | Auto-refresh on file changes (150ms debounce) |
| **File Operations** | Create, rename, delete files and folders |
| **Project Switching** | Change project folder at runtime |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Arrow Up/Down` | Navigate files |
| `Enter` | Open file / Toggle fullscreen |
| `Backspace` | Parent directory |
| `E` | Edit mode |
| `Ctrl+S` | Save |
| `Ctrl+B` | Toggle sidebar |
| `A` / `Shift+A` | New file / New folder |
| `R` | Rename |
| `Del` | Delete |
| `C` | Copy path |
| `Esc` | Close / Back |

## Tech Stack

| Component | Technology |
|---|---|
| App Framework | Tauri v2 |
| Backend | Rust |
| Frontend | React + Vite |
| Markdown | react-markdown + remark-gfm |
| Code Highlight | react-syntax-highlighter (Prism) |
| File Watching | notify crate (OS-native) |

## Project Structure

```
vibe/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── commands/    # Tauri commands (file ops, watcher, dialog)
│   │   ├── watcher/     # File system watcher with debounce
│   │   ├── constants.rs # Shared constants
│   │   ├── error.rs     # Error types
│   │   ├── state.rs     # App state management
│   │   └── lib.rs       # App setup
│   ├── Cargo.toml
│   └── tauri.conf.json
├── client/              # React frontend
│   ├── src/
│   │   ├── App.jsx      # Main UI component
│   │   └── api.js       # Tauri IPC layer
│   └── package.json
└── README.md
```

## Roadmap

- [x] **Phase 1**: File tree + viewer + file watching
- [ ] **Phase 2**: Git integration + project switcher + diff view
- [ ] **Phase 3**: Dashboard, templates, UI polish → v1.0

## License

MIT

---
*Created with vibe-coding.*
