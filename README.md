# vibe (Web UI) — Lightweight AI IDE

**vibe** is a browser-based, ultra-lightweight AI IDE. It combines the power of your local terminal with an elegant browser UI, providing the most comfortable environment for using AI CLIs like Claude Code and Gemini.

[한국어 설명 (Korean README)](./README.ko.md)

## 🚀 Getting Started

### 1. Installation & Linking
Build the client and link the server command globally to use `vibe` anywhere.

```bash
# Build the client
cd client
npm install
npm run build

# Setup the server and link the command
cd ../server
npm install
npm link
```

### 2. Usage
Navigate to any project directory and type `vibe`.

```bash
# Start in the current directory
vibe .

# Start in a specific project directory
vibe ~/projects/my-awesome-app
```

## ⌨️ Key Shortcuts

| Feature | Shortcut | Description |
|:---:|:---:|:---|
| **Toggle Sidebar** | <kbd>Ctrl</kbd> + <kbd>B</kbd> | Show or hide the file explorer. |
| **Focus Terminal** | <kbd>Ctrl</kbd> + <kbd>`</kbd> | Instantly move input focus to the terminal from anywhere. |
| **Navigate Explorer** | <kbd>Esc</kbd> | Exit the terminal/viewer and move to the file explorer. |
| **Open File** | <kbd>Enter</kbd> | Select a file in the explorer to open it in the viewer (middle pane). |
| **Close Viewer** | <kbd>Esc</kbd> | Close the viewer when it has focus. |

## ✨ Key Features
*   **Perfect Terminal**: 100% integrated with your default shell ($SHELL) and supports 256 colors.
*   **Intelligent Layout**: Automatically transitions to a 3-pane layout when a file is opened, and expands the terminal when closed.
*   **Security**: Inherently blocks file access outside the local project folder.
*   **Auto-shutdown**: Automatically terminates the server 3 seconds after all browser tabs are closed.

---
*Created with vibe-coding.*
