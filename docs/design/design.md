# Design System — Vibe

## Product Context

- **What this is:** A native desktop companion app for developers using AI coding CLIs. Sits beside the terminal while AI writes code, auto-refreshes when files change.
- **Who it's for:** Solo developers (and small teams) doing AI-assisted coding with tools like Claude Code.
- **Space/industry:** Developer tools — specifically AI coding companion apps.
- **Project type:** Desktop app (Tauri v2), two-pane layout (file explorer + file viewer).

## Aesthetic Direction

- **Direction:** Brutally Minimal with warm organic undertones
- **Decoration level:** Minimal — UI chrome disappears, content is everything
- **Mood:** A reading surface, not an IDE. Warm paper, not cold terminal. The tool recedes. The code fills the window and nothing fights it.
- **Design insight:** Every dev tool competes to be the primary environment — dense, powerful, loaded with debuggers and build tools. When coding with AI, you don't need any of that. The real collaboration happens through documents. Vibe's design reflects this: *more ambient* than the category norm — readable, calm, focused on documents and context rather than controls.

## Typography

- **Directory names:** Instrument Serif italic — every dev tool uses grotesque-only. The serif italic makes folders feel annotated rather than computed. The single most surprising choice.
- **UI / filenames / metadata:** Geist 14px — more stable than Inter at small sizes, excellent tabular numbers for file sizes and line counts. Not the overused Inter.
- **Code / file content:** JetBrains Mono — `letter-spacing: 0.01em` applied. Barely perceptible. Makes code feel like typeset prose rather than a terminal dump.
- **Loading:** Google Fonts CDN — `Instrument+Serif:ital@0;1` + `Geist:wght@300;400;500;600` + `JetBrains+Mono:wght@400;500`
- **Scale:**
  - `xs`: 10px (swatch labels, explorer root header)
  - `sm`: 11px (footer shortcuts, metadata, labels)
  - `base`: 13px (tree items, UI text)
  - `md`: 14px (Geist body, directory serif)
  - `lg`: 15px (viewer content prose)
  - `xl`: 18–32px (Instrument Serif display use)

## Color

- **Approach:** Restrained — warm neutrals, single rust accent for active/live states

### Light — Daylight (default)

```css
--bg:          #F5F0E8;  /* aged paper */
--surface:     #FDFAF4;  /* warm white — viewer pane */
--surface-2:   #EDE8DC;  /* faint fold — titlebar, hover bg */
--text:        #1A1612;  /* near-black with warmth */
--muted:       #8C8070;  /* faded ink — metadata, shortcuts */
--accent:      #C85A2A;  /* rust orange — active file, file-changed, focus */
--accent-sub:  #F0DDD2;  /* rust wash — badge bg, hover state */
--border:      #D9D2C2;  /* old paper edge */
```

### Dark — Midnight

```css
--bg:          #12100E;  /* warm near-black (NOT cold slate) */
--surface:     #1C1916;  /* dark walnut */
--surface-2:   #242018;  /* slightly lighter */
--text:        #EDE5D8;  /* warm off-white */
--muted:       #7A6F60;  /* dim amber */
--accent:      #E8703A;  /* warm ember */
--accent-sub:  #2A1C12;  /* ember shadow */
--border:      #2E2820;  /* dark seam */
```

### Semantic

```css
--success:  #3A7D52  (dark: #4A9E68)
--warning:  #B07A2A  (dark: #C89040)
--error:    #9B3030  (dark: #C04848)
--info:     #2A587B  (dark: #4080A8)
```

- **Dark mode strategy:** Warm dark, not cold slate. Same hue family as light mode (warm brown-black). Reduce accent saturation slightly. Surfaces use brown-tinted darks, never pure #000 or blue-grays.

## Spacing

- **Base unit:** 8px
- **Density:** Comfortable — more generous than a dense IDE, less spacious than a marketing site
- **Scale:** `2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)`

## Layout

- **Approach:** Grid-disciplined — strict two columns, predictable, familiar to developers
- **Explorer pane:** 220px fixed width
- **Viewer pane:** flex 1 (fills remaining space)
- **Max content width in viewer:** 72ch for prose/markdown, full width for code
- **Line height in viewer:** 1.75 — generous, reading-focused
- **Border radius:** `sm:4px md:6px lg:8px window:10px`
- **No toolbar.** The window is two columns. Nothing else. The 22px footer is the only persistent chrome — `--muted` text on `--bg`, `1px` top border. A caption, not a toolbar.

## Explorer Conventions

- Directory names: Instrument Serif italic, 14px
- File names: Geist, 13px
- Active file: rust `·` dot to the left (not a background fill)
- Hovered item: `background: var(--surface-2)` + `2px` left border in `--accent`
- Explorer root header: `11px`, uppercase, `letter-spacing: 0.08em`, `--muted` color

## File-Changed Indicator

- Badge with `background: var(--accent-sub)`, `color: var(--accent)`, pulsing opacity animation
- 2s ease-in-out infinite — `0%/100%: opacity 1`, `50%: opacity 0.6`
- Reads as: "something happened" — not alarming, just warm acknowledgement

## State Indicators

- **원칙:** 상태 표시는 가볍고 subtle하게. 큰 점(●)이나 무거운 아이콘 대신, 색상 변화 + 가벼운 텍스트 기호로.
- **Unsaved (dirty):** 파일명 색상 `var(--text)` → `var(--accent)` 전환 (150ms) + 이름 뒤 ` *` (애스터리스크). 무거운 ● 금지.
- **Externally changed:** 헤더에 작은 텍스트 배지 `changed externally` (10px, warning 색상). 모달이나 알림창 아님.
- **Git status badge:** `●` 12px — 파일/대시보드 문서 행 우측 끝. 상태별 색상:
  - `added` → `var(--success)` 초록
  - `untracked` → `#4DA8A4` 청록
  - `modified` → `var(--warning)` 주황
  - `deleted` → `var(--error)` 빨강
  - `renamed` → `#7B9FD4` 청회색
  - 접힌 폴더는 bubble-up. 우선순위: deleted > modified > renamed > added > untracked
- **File-changed pulse:** accent-sub 배경 + 4px 도트, 2s ease-in-out 펄스. 인지만 시키고 방해하지 않음.
- **공통 기조:** "something happened"를 알리되 alarming하지 않게. 협업 도구답게 차분하게.

## Motion

- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** `enter: ease-out`, `exit: ease-in`, `move: ease-in-out`
- **Duration:** `micro: 50–100ms`, `short: 150ms`, `medium: 250ms`
- **What gets animation:** file-changed badge pulse, hover state transitions (150ms), theme toggle (300ms)
- **What does NOT get animation:** file tree navigation, pane switching — instant

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-04 | Light-first default | Vibe is a reading tool. Books default light. Every other dev tool defaults dark because they're writing-focused. Vibe differentiates here. |
| 2026-04-04 | Instrument Serif italic for directories | No dev tool uses serif. Makes folders feel annotated. Single most surprising visual choice. |
| 2026-04-04 | Rust/ember accent (#C85A2A / #E8703A) | VS Code=blue, Cursor=teal, Zed=purple. Warm rust signals "something changed" without alarm. Analog, immediate. |
| 2026-04-04 | Warm dark (walnut) over cold dark (slate) | Consistent with warm light palette. Feels ambient. Coheres with the "reading surface" identity. |
| 2026-04-04 | Geist over Inter | Inter is overused in dev tools. Geist is stable at small sizes with better tabular numbers. |
| 2026-04-10 | Dirty indicator: `*` + color, not `●` | 큰 점은 "맹구 코" — 우리 기조(ambient, reading surface)에 안 맞음. 색상 전환 + 가벼운 기호로 충분. |
| 2026-04-18 | Git badge 5-color: added=green, untracked=teal, modified=orange, deleted=red, renamed=steel blue | 상태별 의미가 다르므로 색으로 구분. 우선순위 있는 bubble-up으로 폴더에도 반영. |
