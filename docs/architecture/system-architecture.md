# Vibe v1.0.0 — 시스템 아키텍처 & 코드 구조 정의서

> Tauri v2 데스크톱 앱. WebView 위 React 프론트엔드, Rust 백엔드(파일 작업, git, 파일시스템 감시).
> 이 문서는 v1.0.0 (2026-04-09) 기준이며, App.jsx 모듈 분리 이후 코드 구조를 반영합니다.

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  macOS / Windows / Linux                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Tauri v2 Shell (WKWebView on macOS, WebView2 on Windows) │  │
│  │  ┌──────────────────────┐  ┌────────────────────────────┐ │  │
│  │  │   React Frontend     │  │    Rust Backend             │ │  │
│  │  │                      │  │                             │ │  │
│  │  │  App.jsx             │──│  commands/                  │ │  │
│  │  │   ├ FileExplorer  ──invoke──▶ file_ops (list/read/    │ │  │
│  │  │   ├ FileViewer    ──invoke──▶        write/create/    │ │  │
│  │  │   ├ Dashboard     ──invoke──▶        delete/rename)   │ │  │
│  │  │   └ NoRootScreen  ──invoke──▶ dialog (pick_folder)    │ │  │
│  │  │                      │  │  watcher_cmd (set/get_root) │ │  │
│  │  │  api.js ◀──event───  │  │  git (status/diff)          │ │  │
│  │  │   "file-changed"     │  │                             │ │  │
│  │  └──────────────────────┘  │  watcher/                   │ │  │
│  │                            │   notify → debounce 150ms   │ │  │
│  │                            │   → emit "file-changed"     │ │  │
│  │                            └────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐                                                │
│  │ Filesystem   │  notify crate (recursive watch)                │
│  └──────────────┘                                                │
└──────────────────────────────────────────────────────────────────┘
```

**통신 방식:**
- Frontend → Backend: `@tauri-apps/api/core` `invoke()` (IPC, JSON 직렬화)
- Backend → Frontend: `tauri::Emitter::emit("file-changed", payload)` (이벤트)
- 네트워크 통신 없음. 모든 데이터는 로컬 파일시스템.

---

## 2. Directory Structure

```
vibe/
├── client/                          # React frontend (Vite)
│   ├── src/
│   │   ├── main.jsx                 # React DOM entry
│   │   ├── App.jsx                  # state management, layout, global keys
│   │   ├── api.js                   # all invoke() calls (Rust ↔ JS bridge)
│   │   ├── constants.js             # shared constants, helpers, styles
│   │   └── components/
│   │       ├── FileExplorer.jsx     # tree navigation, CRUD, git badges
│   │       ├── FileViewer.jsx       # code/markdown/diff viewer + editor
│   │       ├── Dashboard.jsx        # project stats, docs, recent changes
│   │       ├── NoRootScreen.jsx     # project picker + dropdown
│   │       ├── DiffView.jsx         # inline/split diff (virtualized)
│   │       ├── MarkdownView.jsx     # markdown renderer + image support
│   │       └── CodeRow.jsx          # virtualized code row
│   ├── index.html
│   ├── style.css                    # CSS variables (light/dark), keyframes
│   └── package.json
│
├── src-tauri/                       # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── main.rs                  # entry point
│   │   ├── lib.rs                   # Tauri builder, plugin/handler registration
│   │   ├── state.rs                 # AppState (root + watcher behind Mutex)
│   │   ├── error.rs                 # AppError enum (thiserror + Serialize)
│   │   ├── constants.rs             # IGNORED directory list
│   │   ├── commands/
│   │   │   ├── mod.rs               # command module exports
│   │   │   ├── file_ops.rs          # file CRUD, list_all_files, read_image
│   │   │   ├── git.rs               # git_status, git_diff (libgit2)
│   │   │   ├── watcher_cmd.rs       # set_root, get_root
│   │   │   └── dialog.rs            # pick_folder (native async)
│   │   └── watcher/
│   │       ├── mod.rs               # spawn_watcher, event filtering
│   │       └── debounce.rs          # 150ms debounce, blocks when idle
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── capabilities/
│       └── default.json
│
├── CLAUDE.md                        # AI assistant instructions
├── README.md / README.ko.md
└── docs/
    ├── architecture/                # 구현 완료된 설계 문서
    ├── plan/                        # 진행 중인 설계 문서
    └── reference/
        └── design.md               # 디자인 시스템 스펙
```


---

## 3. Rust Backend

### 3.1 State Management

```rust
// state.rs
pub struct AppState {
    pub root: Mutex<Option<PathBuf>>,      // 현재 프로젝트 루트 경로
    pub watcher: Mutex<Option<RecommendedWatcher>>,  // 파일시스템 워쳐
}
```

- `root`와 `watcher`는 항상 쌍으로 업데이트 (watcher lock을 잡고 root 교체 → watcher 교체)
- `get_root()` — `LockPoisoned` / `NoRootSet` 에러 반환

### 3.2 Error Handling

```rust
// error.rs — thiserror 기반, Serialize 구현 (JS로 문자열 전달)
pub enum AppError {
    AccessDenied,    // 경로가 프로젝트 루트 밖
    NoRootSet,       // 폴더 미선택
    FileTooLarge,    // >1MB (텍스트), >10MB (이미지)
    BinaryFile,      // 첫 100바이트에 null byte
    Io(io::Error),
    RootNotAllowed,  // 루트 디렉토리에 write/delete 시도
    Watcher(notify::Error),
    Git(git2::Error),
    LockPoisoned,    // Mutex poisoned
}
```

### 3.3 Commands (IPC Handlers)

| Command | Module | 설명 |
|---------|--------|------|
| `list_files` | file_ops | 단일 디렉토리 목록. Explorer 트리용. `include_mtime` 옵션. |
| `list_all_files` | file_ops | 전체 재귀 스캔 (depth ≤ 20). Dashboard 통계용. `AllFilesListing` 반환. |
| `read_file` | file_ops | 텍스트 파일 읽기 (≤1MB, binary 감지). |
| `write_file` | file_ops | 파일 쓰기 (루트 직접 쓰기 불가). |
| `create_item` | file_ops | 파일/디렉토리 생성. |
| `delete_item` | file_ops | 파일/디렉토리 삭제. |
| `rename_item` | file_ops | 이름 변경. |
| `read_image` | file_ops | 이미지 → `data:<mime>;base64,...` (≤10MB). Markdown 이미지용. |
| `set_root` | watcher_cmd | 프로젝트 루트 설정 + watcher 시작. |
| `get_root` | watcher_cmd | 현재 루트 경로 반환. |
| `pick_folder` | dialog | 네이티브 폴더 선택 다이얼로그 (async). |
| `git_status` | git | 브랜치명 + dirty 파일 목록 (상대경로 → 상태). |
| `git_diff` | git | 특정 파일의 hunk-level diff (context 3줄). |

**경로 보안:** 모든 파일 접근은 `validate_path(root, raw, allow_root)` 를 거침. `canonicalize()` 후 루트 prefix 검증.

**필터링:** `constants.rs`의 `IGNORED` 리스트 + `.tmp.` 패턴 (Claude Code atomic write) + dotfile 스킵.

### 3.4 File Watcher

```
notify crate (RecursiveMode::Recursive)
  │
  ▼
mpsc channel → debounce thread (150ms window, blocks when idle)
  │
  ▼
build_payload() — is_ignored() 필터링
  │
  ▼
app.emit("file-changed", FileChangedPayload { paths, kind })
```

**`.git/` 필터링 예외:** `HEAD`, `index`, `refs/heads/*` — 이 3가지만 통과 (branch/commit 변경 감지용).

### 3.5 Git Integration

- **libgit2** (`git2` crate) — 외부 git CLI 의존 없음
- `open_repo()`: `Repository::discover()` 후 workdir == root 검증 (부모 repo 무시)
- `git_status`: `StatusOptions` with untracked + recurse
- `git_diff`: `diff_tree_to_workdir_with_index`, `RefCell<Vec<Hunk>>` 패턴으로 콜백 간 공유
- `classify(Status)`: conflict > deleted > renamed > added > untracked > modified 우선순위

### 3.6 Dependencies (Cargo.toml)

| Crate | Version | 용도 |
|-------|---------|------|
| `tauri` | 2 | 앱 프레임워크 |
| `tauri-plugin-dialog` | 2 | 네이티브 폴더 선택 |
| `tauri-plugin-cli` | 2 | CLI 인자 (`vibe /path`) |
| `serde` / `serde_json` | 1 | IPC 직렬화 |
| `notify` | 6 | 파일시스템 watch |
| `thiserror` | 1 | 에러 타입 매크로 |
| `tokio` | 1 (sync) | oneshot channel (dialog) |
| `git2` | 0.19 | libgit2 바인딩 |
| `base64` | 0.22 | 이미지 인코딩 |

**Release 프로필:** `opt-level = "z"`, LTO, single codegen unit, strip — 최소 바이너리.

---

## 4. React Frontend

### 4.1 Component Hierarchy

```
App
├── NoRootScreen          — rootReady=false 일 때 표시
│   └── ProjectDropdown   — footer 프로젝트 전환 드롭다운
│
├── FileExplorer          — 좌측 사이드바 (240px, Ctrl+B 토글)
│
├── FileViewer            — selectedFile != null 일 때 표시
│   ├── CodeRow           — 가상화 코드 행
│   ├── DiffView          — diff 모드
│   │   ├── DiffRowInline
│   │   └── DiffRowSplit
│   └── MarkdownView      — .md 파일 렌더링
│       └── MarkdownImage  — base64 이미지 로딩
│
└── ProjectDashboard      — selectedFile=null 일 때 표시
    ├── DocItem              — 문서 행 (핀, git 뱃지, 라인 수)
    ├── BrokenLinksSection
    ├── OrphanDocsSection
    └── GraphView            — 링크 그래프 (d3-force)
```

### 4.2 View States

```
rootReady=false  →  NoRootScreen (프로젝트 미선택)
rootReady=true   →  Left: FileExplorer (항상)
                     Right:
                       selectedFile=null   →  Dashboard
                       selectedFile!=null  →  FileViewer
                         isEditing=false, diffMode=false  →  보기 모드
                         isEditing=false, diffMode=true   →  diff 모드
                         isEditing=true                   →  편집 모드
```

### 4.3 Module Responsibilities

#### `App.jsx` — Orchestrator

핵심 역할: **전역 상태 관리**, **IPC 이벤트 핸들링**, **키보드 라우팅**, **레이아웃**

- 17개 `useState` (rootReady, selectedFile, fileContent, isEditing, diffMode, editContent, theme, ...)
- 10개 `useRef` (각 state의 최신값을 keydown 핸들러에서 참조)
- `loadDashboard()` — `list_all_files` → 언어 통계, 문서 그룹, 최근 변경 계산
- `loadGitStatus()` — `git_status` → `Map<absPath, state>` 변환 + 변경 감지 최적화
- `onFileChanged` 리스너 — explorer refresh, git refetch, dashboard debounce, recent changes 갱신
- `requireClean` 패턴 — 편집 중 파일 전환/닫기 시 "저장하시겠습니까?" 모달
- 글로벌 keydown: `Ctrl+B` sidebar, `Ctrl+Shift+L` theme, `Cmd+1-9` project switch, `Ctrl+R` refresh, `Esc` close/exit, viewer keys (E/D/L/Space)

#### `FileExplorer.jsx` — Tree Navigation

Props: `onFileSelect`, `isFocused`, `innerRef`, `refreshKey`, `activeFilePath`, `changedFiles`, `gitFiles`, `gitInfo`

- 가상 트리: `rootItems` + `expandedDirs` + `childrenCache` → `visibleItems` (flat list with depth)
- `toggleDir()`: expand/collapse + lazy fetch (`api.listFiles`)
- 파일 CRUD: A(new), Shift+A(new dir), R(rename), D(delete), C(copy path)
- Reveal: `activeFilePath` 변경 시 부모 디렉토리 자동 확장 + 스크롤
- `dirtyDirs` — 접힌 폴더에 dirty 파일이 있으면 bubble-up 배지
- Git 배지: 2-state (touched=accent, deleted=muted)

#### `FileViewer.jsx` — Code/Markdown/Diff Viewer + Editor

Props: `selectedFile`, `content`, `isEditing`, `editContent`, `isDirty`, `isMd`, `isDark`, `diffMode`, `gitDirty`, `externallyChanged`, ...

- **보기 모드**: `react-syntax-highlighter` + `react-window` (가상화) / `react-markdown` + `rehype-raw`
- **편집 모드**: `<textarea>` + line number gutter (동기 스크롤, `translateY` 트릭)
- **Diff 모드**: `api.gitDiff()` → `DiffView` (inline/split 토글)
- **외부 변경 감지**: `externallyChanged` 배지 → L키로 reload
- Tab indent (2 spaces), Ctrl+S save, Ctrl+P edit/preview (md)

#### `Dashboard.jsx` — Project Overview

Props: `data`, `recentChanges`, `brokenLinks`, `orphanDocs`, `graphData`, `onFileOpen`, `onRefresh`, `gitInfo`

- 헤더 — 프로젝트명, path, `⎇ branch ~ N changed`, inline stats (`128 files · 32 folders · 6 langs · 19 docs`). v1.2.x에서 PROJECT StatCard 4개를 헤더로 흡수.
- 언어 분포 바 차트 (단독 row)
- 문서 목록 (그룹별, 설명 + 라인 수, 핀 가능)
- Recently Changed (10개, `formatAge`)
- Broken Links / Orphan Docs (각 단독 row, 항목 있을 때만)
- Link Graph — `GraphView` (d3-force, 페이지 맨 아래, 항상 펼침)
- Refresh 버튼 (Ctrl+R 연동)

#### `NoRootScreen.jsx` — Project Picker

- "폴더 열기" 버튼 → `api.pickFolder()`
- Recent Projects 목록 (drag-to-reorder, 삭제, `Cmd+N` 단축키)
- `ProjectDropdown` — footer에서 프로젝트 전환

#### `DiffView.jsx`

- `flattenHunks()` → inline rows, `pairHunks()` → side-by-side pairs
- `react-window` `VirtualList`로 렌더링
- 색상: `color-mix(in srgb, var(--success/error) 12%, transparent)`

#### `MarkdownView.jsx`

- `react-markdown` + `remark-gfm` + `rehype-raw`
- `MarkdownImage`: 로컬 이미지 → `api.readImage()` → base64 data URL
- 커스텀 컴포넌트: h1(Instrument Serif italic), code(SyntaxHighlighter), table, blockquote...

#### `CodeRow.jsx`

- `react-syntax-highlighter`의 `createElement`로 단일 행 렌더링
- Sticky line number gutter

### 4.4 `api.js` — IPC Bridge

```js
// 모든 Rust 커맨드의 JS 바인딩. 단일 접점.
listFiles(path, { includeMtime })  →  invoke('list_files', ...)
listAllFiles()                     →  invoke('list_all_files')
readFile(path)                     →  invoke('read_file', ...)
readImage(path)                    →  invoke('read_image', ...)
writeFile(path, content)           →  invoke('write_file', ...)
createItem(path, isDirectory)      →  invoke('create_item', ...)
deleteItem(path)                   →  invoke('delete_item', ...)
renameItem(oldPath, newPath)       →  invoke('rename_item', ...)
setRoot(path)                      →  invoke('set_root', ...)
getRoot()                          →  invoke('get_root')
pickFolder()                       →  invoke('pick_folder')
gitStatus()                        →  invoke('git_status')
gitDiff(path)                      →  invoke('git_diff', ...)
onFileChanged(callback)            →  listen('file-changed', ...)
```

### 4.5 `constants.js` — Shared Constants

| Category | Exports |
|----------|---------|
| Layout | `LINE_HEIGHT_PX (22)`, `EDIT_PADDING_PX (16)`, `LINE_NUM_WIDTH ('5ch')` |
| Fonts | `FONT_MONO`, `FONT_SERIF`, `FONT_UI` |
| Keyboard | `resolveKey(key)` — 한글 키 매핑 + toLowerCase |
| File icons | `ICON_MAP`, `getIcon(name)`, `getDocIcon(name)` |
| Classification | `DOC_EXTENSIONS`, `DOC_FOLDERS`, `EXT_TO_LANG`, `LANG_COLORS` |
| Shortcuts | `SHORTCUTS_VIEWER_VIEW`, `..._DIRTY`, `..._DIFF`, `..._EDIT`, `..._EDIT_MD`, `SHORTCUTS_EXPLORER` |
| Git | `GIT_BADGE_TOUCHED`, `gitBadgeFor(state)` |
| Helpers | `formatReadError`, `formatAge`, `isHiddenFile`, `basenameOf`, `makeRecentEntry` |
| Styles | `SECTION_LABEL`, `DIVIDER`, `CODE_ROW_STYLE`, `DIFF_ROW_STYLE`, ... |
| Projects | `loadProjects`, `saveProjects`, `addProject`, `removeProject`, `reorderProjects` |
| Explorer | `getIndent(depth)` |

### 4.6 Frontend Dependencies (package.json)

| Package | Version | 용도 |
|---------|---------|------|
| `@tauri-apps/api` | ^2 | Rust IPC (invoke/listen) |
| `react` / `react-dom` | ^18.2 | UI |
| `react-markdown` | ^10.1 | Markdown 렌더링 |
| `react-syntax-highlighter` | ^16.1 | 코드 하이라이팅 |
| `react-window` | ^2.2 | 가상 스크롤 (코드, diff) |
| `rehype-raw` | ^7 | Markdown 내 raw HTML 지원 |
| `remark-gfm` | ^4 | GFM (테이블, 체크박스...) |
| `vite` | ^4.4 | 번들러 |

---

## 5. Data Flow

### 5.1 프로젝트 열기

```
User clicks "폴더 열기"
  → api.pickFolder() → Rust dialog::pick_folder (native)
  → switchProject(path)
    → api.setRoot(path) → Rust: validate dir, set root, spawn_watcher
    → reset all state (selectedFile, gitInfo, dashboard...)
    → addProject(path) → localStorage
    → setRefreshKey(k+1) → Explorer re-fetches
    → loadDashboard() + loadGitStatus()
```

### 5.2 파일 변경 감지

```
External tool modifies file
  → notify crate detects change
  → debounce thread accumulates events (150ms)
  → build_payload: filter IGNORED, dedup paths
  → emit "file-changed" { paths, kind }
  → JS listener:
    ├── .git/ paths → scheduleGitRefetch (200ms debounce)
    ├── non-git paths:
    │   ├── refreshKey++ → Explorer re-fetches visible dirs
    │   ├── changedFiles.add → Explorer pulse badges
    │   ├── recentChanges prepend + readFile for line counts
    │   └── dashboardRefetchTimer (2s) → loadDashboard()
    └── if path === selectedFile → setExternallyChanged(true)
```

### 5.3 Git Status 흐름

```
loadGitStatus(rootPath)
  → api.gitStatus() → Rust git::git_status
  → { isRepo, branch, files: { "src/main.rs": "modified", ... } }
  → JS: files → Map<absPath, state> (rootPath + '/' + rel)
  → Short-circuit: branch/size/entries 동일하면 prev 반환 (re-render 방지)
  → gitInfo state → FileExplorer badges, Dashboard badges, FileViewer diff 버튼
```

---

## 6. Keyboard Architecture

```
window.addEventListener('keydown', globalHandler)
  │
  ├── Ctrl+B          → toggleSidebar
  ├── Ctrl+Shift+L    → theme toggle
  ├── Cmd+1-9         → switchProject
  ├── Ctrl+R          → dashboardRefreshTrigger++
  ├── Escape          → handleEscapeKey (exit edit → close file → focus explorer)
  │
  └── activeFocus === 'viewer'
      └── handleViewerKey
          ├── E        → enter edit mode
          ├── D        → enter diff mode (if git dirty)
          ├── L        → reload (if externally changed)
          └── Space    → page scroll (Shift+Space = up)

FileExplorer (own keydown, isFocused guard):
  ├── ↑↓        → navigate
  ├── Enter     → open/toggle
  ├── Backspace → collapse parent
  ├── A/Shift+A → new file/dir
  ├── R         → rename
  ├── D         → delete
  └── C         → copy path
  (all with !ctrlKey && !metaKey guard to avoid Cmd+C conflict)

FileViewer (own keydown, diffMode only):
  ├── Shift+D   → toggle inline/split
  └── V/D       → exit diff

FileViewer (own keydown, edit + md):
  └── Ctrl+P    → edit/preview toggle
```

---

## 7. Security Model

| Layer | Mechanism |
|-------|-----------|
| Path traversal | `validate_path()` — canonicalize + root prefix check |
| File size | 1MB text, 10MB image, 1MB diff |
| Binary detection | Null byte in first 100 bytes → reject |
| CSP | `default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:` |
| Root protection | `RootNotAllowed` error — 루트 디렉토리 직접 write/delete 불가 |
| Network | 없음. 완전 오프라인. |

---

## 8. Build & Distribution

```bash
# Development
npx @tauri-apps/cli@^2 dev          # Vite HMR + Rust backend

# Production
npx @tauri-apps/cli@^2 build        # .app (macOS), .msi (Windows), .deb/.AppImage (Linux)

# Rust만 확인
cd src-tauri && cargo check          # 반드시 src-tauri/ 에서 실행

# Client만
cd client && npm run build           # dist/ 출력
```

**CI/CD:** GitHub Actions `release.yml` — tag push (`v*`) → `tauri-action`으로 macOS/Windows/Linux 빌드 → GitHub Release 자동 생성.

**App Config** (`tauri.conf.json`):
- identifier: `com.vibe.app`
- window: 1280×800, min 800×500
- CLI: `vibe /path/to/project` (optional positional arg)
- icons: 32/128/256px PNG + ICNS + ICO

---

## 9. Design System Summary

> 전체 스펙: `docs/design/design.md`

- **방향:** Brutally Minimal + warm organic. 읽는 도구, IDE 아님.
- **폰트:** Instrument Serif italic (디렉토리) / Geist (UI) / JetBrains Mono (코드)
- **색상:** Warm neutrals + rust accent (`#C85A2A` light / `#E8703A` dark). Dark mode는 cold slate가 아닌 warm walnut.
- **레이아웃:** Explorer 240px + Viewer flex. Footer 22px (유일한 persistent chrome). Markdown max-width 72ch.
- **모션:** Minimal. 150ms hover transitions, 2s badge pulse. Tree navigation과 pane switching은 즉시.


<!-- external change test -->
