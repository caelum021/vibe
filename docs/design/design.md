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

### Palette — Cool-shift (2026-04-19, current)

Claude(warm cream/coral) 계열과의 시각적 분리 및 브랜드 명료화를 위한 미세 조정. rust accent는 유지, "warm paper reading surface" 기조는 유지하되 neutral의 chroma를 살짝 낮춤. 2026-04-04 팔레트는 위에 이력으로 보존.

#### Light — Daylight (cool-shift)

```css
--bg:          #F2EEE5;  /* cool ivory — aged paper, chroma 살짝 감소 */
--surface:     #FAF8F2;  /* off-white — viewer pane */
--surface-2:   #E9E5D9;  /* faint fold — titlebar, hover bg */
--text:        #1A1814;  /* near-black, 덜 따뜻 */
--muted:       #857B70;  /* faded ink — metadata, shortcuts */
--accent:      #C85A2A;  /* rust orange — 유지 (브랜드 시그니처) */
--accent-sub:  #EEDBD2;  /* rust wash */
--border:      #D3CCBE;  /* old paper edge */
```

#### Dark — Midnight (cool-shift)

```css
--bg:          #131210;  /* near-black, 중립 방향 */
--surface:     #1B1917;  /* walnut, chroma 감소 */
--surface-2:   #222019;  /* slightly lighter */
--text:        #EBE5DA;  /* off-white, 덜 따뜻 */
--muted:       #77716A;  /* dim neutral — orange tinge 제거 */
--accent:      #E8703A;  /* warm ember — 유지 */
--accent-sub:  #2A1C12;  /* ember shadow */
--border:      #2C2923;  /* dark seam */
```

적용은 v1.1.0 브랜딩 트랙에서 CSS 변수 교체. 대시보드·IA 전면 개편은 [`vibe-design-system-v2-proposal.md`](./vibe-design-system-v2-proposal.md)에 보관 (deferred).

### Semantic

```css
--success:  #3A7D52  (dark: #4A9E68)
--warning:  #B07A2A  (dark: #C89040)
--error:    #9B3030  (dark: #C04848)
--info:     #2A587B  (dark: #4080A8)
```

- **Dark mode strategy:** Warm dark, not cold slate. Same hue family as light mode (warm brown-black). Reduce accent saturation slightly. Surfaces use brown-tinted darks, never pure #000 or blue-grays.

## Logo (추가 — 2026-04-19)

브랜드 마크. 기존 로고 타이포(Instrument Serif italic)는 유지하고, 끝에 accent 색 마침표를 붙여 vibe의 "액션이 완결되는 지점" 의미를 시각화한다. 이것만으로도 Claude 계열 브랜드와 구분된다.

```jsx
<span className="vibe-logo">
  vibe<span className="vibe-logo-dot">.</span>
</span>
```

```css
.vibe-logo {
  font-family: var(--font-serif-italic);   /* Instrument Serif italic */
  font-style: italic;
  color: var(--text);
}
.vibe-logo-dot {
  font-style: normal;                       /* 마침표는 이탤릭 아님 */
  color: var(--accent);                     /* 항상 rust accent — 검정 금지 */
}
```

**규칙:**
- 마침표는 **항상** `--accent` 색. `--text` 검정으로 두지 않는다.
- 마침표 타이포는 **normal**(이탤릭 아님) — 점이 이탤릭으로 찌그러지지 않도록.
- 최소 렌더 크기 24px. 그 이하에서는 앱 아이콘(파비콘/dock)처럼 "마침표가 시각적으로 보장되는" 별도 에셋 사용.
- 앱 아이콘, 파비콘, DMG 배경, About 모달 모두 마침표 일관 반영.

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
| 2026-04-19 | 팔레트 cool-shift (neutral chroma 감소, rust accent 유지) | Claude의 warm cream/coral 팔레트와 시각적으로 가까워져 브랜드 혼동 발생. "warm paper reading surface" 기조는 유지하되 neutral만 덜 따뜻하게. 이전 팔레트는 섹션으로 보존. |
| 2026-04-19 | 로고 마침표 — normal weight, accent 색 고정 | "액션이 완결되는 지점"의 브랜드 시그니처. 로고 타이포(Instrument Serif italic)는 유지. 앱 아이콘·파비콘·DMG·About 모달 일관 반영 필요. |
| 2026-04-19 | 대시보드·IA 전면 개편 defer — markdown 1급 시민(v1.1.0) 우선 | 옵시디언 앵커 함정 경계. 조용한 도구 기조는 단계별로 조정. markdown 기능이 새 surface(그래프, 링크 탐색 등)를 만들면 그때 [`vibe-design-system-v2-proposal.md`](./vibe-design-system-v2-proposal.md)를 재료로 재설계. |
