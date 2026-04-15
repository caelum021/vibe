# vibe

Your window into AI-native coding.

**vibe .** That's all you need.

[한국어 설명 (Korean README)](./README.ko.md)

<p align="center">
  <img src="./assets/screenshot-light.png" width="720" alt="Vibe — light mode" />
</p>
<p align="center">
  <img src="./assets/screenshot-dark.png" width="720" alt="Vibe — dark mode" />
</p>

<br>

## What is Vibe?

When you code with AI, the real collaboration happens through documents. Existing IDEs are bloated with debugging and compilation tools you no longer need. Vibe strips all that away — just documents, edits, and context.

- **Documents are the interface** — Write specs, review AI output, edit files to steer direction. That's the workflow.
- **Always on** — Auto-refreshes when AI changes files. Monitor scope and content in real time.
- **Light and fast** — Tauri native app. ~2MB DMG. No debugger, no compiler, no bloat.

<br>

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

<br>

## Usage

```bash
# Open a specific project folder
vibe /path/to/project

# Open current directory
vibe .

# No argument → folder picker dialog
vibe
```

<br>

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

<br>

## Design

Warm, minimal aesthetic. Aged-paper light theme, warm-walnut dark theme. Rust/ember accent for active states. Typography: Instrument Serif (directories), Geist (UI), JetBrains Mono (code).

<br>

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Arrow Up/Down` | Navigate files |
| `Enter` | Open file / Toggle fullscreen |
| `Backspace` | Parent directory |
| `E` | Edit mode |
| `D` | Diff view |
| `Ctrl+S` | Save |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+R` | Refresh |
| `Ctrl+Shift+L` | Toggle dark mode |
| `Cmd+1-9` | Switch between projects |
| `A` / `Shift+A` | New file / New folder |
| `R` | Rename |
| `Del` | Delete |
| `C` | Copy path |
| `Space` / `Shift+Space` | Page scroll |
| `Esc` | Close / Back |

<br>

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

<br>

## License

MIT
