# vibe

A lightweight, always-on window to see what AI builds.

**vibe .** That's all you need.

[한국어 설명 (Korean README)](./README.ko.md)

<p align="center">
  <img src="./assets/screenshot-light.png" width="720" alt="Vibe — light mode" />
</p>
<p align="center">
  <img src="./assets/screenshot-dark.png" width="720" alt="Vibe — dark mode" />
</p>

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
| **File Explorer** | Project file tree with keyboard navigation, Instrument Serif italic directory names |
| **File Viewer** | Markdown rendering, syntax highlighting, line numbers |
| **File Editing** | Inline edit mode, Ctrl+S to save |
| **File Watching** | Auto-refresh on file changes (150ms debounce), change badges with pulse animation |
| **Git Integration** | Per-file status badges (modified/added/deleted), inline diff view for changed files |
| **File Operations** | Create, rename, delete files and folders |
| **Project Dashboard** | Language distribution bar, document grouping, recently changed files |
| **Multi-Project** | Register multiple projects, switch with Cmd+1-9 or footer dropdown |
| **Dark Mode** | Warm dark theme (walnut, not cold slate), toggle with Ctrl+Shift+L |

## Design

Warm, minimal aesthetic. Aged-paper light theme, warm-walnut dark theme. Rust/ember accent for active states. Typography: Instrument Serif (directories), Geist (UI), JetBrains Mono (code).

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Arrow Up/Down` | Navigate files |
| `Enter` | Open file / Toggle fullscreen |
| `Backspace` | Parent directory |
| `E` | Edit mode |
| `Ctrl+S` | Save |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+Shift+L` | Toggle dark mode |
| `Cmd+1-9` | Switch between projects |
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
| Git | git2 (libgit2) |

## Project Structure

```
vibe/
├── src-tauri/           # Rust backend
│   ├── src/
│   │   ├── commands/    # Tauri commands (file ops, watcher, dialog, git)
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

## License

MIT
