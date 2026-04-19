# vibe · design system v2

_Ink & paper · Nightletter · PM 지향 IA_

현재(v1.1.0) 디자인이 Anthropic Claude와 브랜드 혼동을 일으키는 문제를 해소하고, 제품 서사를 "파일 뷰어"에서 "AI 협업 문서 관리 도구"로 전환하기 위한 디자인 시스템 개편 설계서입니다.

---

## 1. 디자인 원칙

- **차가운 종이, 차가운 잉크.** 배경과 텍스트 모두 cool tone으로 가서 Claude의 warm cream/coral 팔레트와 명확히 분리한다.
- **인디고는 "당신 차례" 신호.** 악센트 컬러는 장식이 아니라 *행동이 필요한 지점*만 지시한다. AI가 편집한 문서, 검토 대기 중인 세션, 로고 마침표.
- **세리프 이탤릭은 유지, 주변을 재배치.** `vibe` 이탤릭 로고는 브랜드 자산이므로 손대지 않는다. 대신 팔레트·여백·스케일을 재설계해 로고가 "차가운 편집실" 맥락에서 다시 태어나도록 한다.
- **정보 위계는 액션 우선.** 대시보드 상단은 "프로젝트가 어떻게 생겼는가" 대신 "지금 뭘 해야 하는가"를 보여준다.

---

## 2. 디자인 토큰

### 2.1 Light mode — Ink & paper

```css
:root {
  /* Surfaces */
  --vibe-paper:          #F2EFE8;                    /* main background (cool ivory) */
  --vibe-paper-raised:   #FFFFFF;                    /* cards — use at ~40% alpha over paper */
  --vibe-paper-sunken:   #ECE9E1;                    /* inputs, inline code */

  /* Ink (text) */
  --vibe-ink:            #1A1F2E;                    /* primary text, logo body */
  --vibe-ink-muted:      #6B6E78;                    /* paths, meta, labels */
  --vibe-ink-faint:      rgba(26, 31, 46, 0.13);     /* dividers, borders */
  --vibe-ink-whisper:    rgba(26, 31, 46, 0.07);     /* row separators */

  /* Accent — indigo */
  --vibe-accent:         #2B3A67;                    /* action required / AI / logo period */
  --vibe-accent-soft:    #E4E7F0;                    /* accent bg, hover states */

  /* Language ramp (neutral + single accent) */
  --vibe-lang-1:         var(--vibe-accent);         /* top language only */
  --vibe-lang-2:         #5F5E5A;
  --vibe-lang-3:         #888780;
  --vibe-lang-4:         #B4B2A9;
  --vibe-lang-5:         #D5D3CB;
}
```

### 2.2 Dark mode — Nightletter

```css
[data-theme="dark"] {
  --vibe-paper:          #141824;                    /* deep ink blue */
  --vibe-paper-raised:   #1C2030;
  --vibe-paper-sunken:   #101420;

  --vibe-ink:            #E8E3D5;                    /* warm cream — 독서등 아래 종이 느낌 */
  --vibe-ink-muted:      #8A8A95;
  --vibe-ink-faint:      rgba(232, 227, 213, 0.13);
  --vibe-ink-whisper:    rgba(232, 227, 213, 0.07);

  --vibe-accent:         #8FA3D8;                    /* lightened indigo for AA contrast */
  --vibe-accent-soft:    rgba(143, 163, 216, 0.12);

  --vibe-lang-1:         var(--vibe-accent);
  --vibe-lang-2:         #9A9A93;
  --vibe-lang-3:         #7A7A74;
  --vibe-lang-4:         #5A5A55;
  --vibe-lang-5:         #40403C;
}
```

### 2.3 기존 "월넛" 테마 제거

현재 월넛 다크모드(따뜻한 브라운)는 Nightletter로 대체한다. 호환성 필요 시 `[data-theme="walnut"]`을 legacy 옵션으로 한 버전 유지 후 제거.

### 2.4 대비 검증

- Light mode `--vibe-ink` on `--vibe-paper`: 14.8:1 (AAA)
- Light mode `--vibe-accent` on `--vibe-paper`: 9.2:1 (AAA)
- Dark mode `--vibe-ink` on `--vibe-paper`: 12.1:1 (AAA)
- Dark mode `--vibe-accent` on `--vibe-paper`: 7.4:1 (AAA)

모두 AA/AAA 통과. `--vibe-ink-muted`는 AA 수준(라이트 4.6:1 / 다크 4.9:1)이므로 본문 외 메타 정보에만 사용.

---

## 3. 타이포그래피

### 3.1 폰트 스택

```css
--font-serif: 'Iowan Old Style', 'Hoefler Text', 'EB Garamond', Georgia, 'Times New Roman', serif;
--font-mono:  ui-monospace, 'SF Mono', 'Menlo', 'Consolas', monospace;
--font-sans:  -apple-system, 'Inter', system-ui, sans-serif;
```

**중요**: Iowan Old Style은 macOS 전용. Windows/Linux 렌더링 품질 확인 후, 필요 시 EB Garamond Italic 번들링 검토 (OFL 라이선스, 상업 사용 가능).

### 3.2 스케일

| 용도 | 폰트 | 크기 | 굵기 | 비고 |
|------|------|------|------|------|
| Logo | serif italic | 38px | 400 | 최소 24px 이하 금지 |
| Stat primary | serif roman | 28px | 400 | 숫자, italic 아님 |
| Section label | mono | 11px | 400 | UPPERCASE, letter-spacing 0.14em |
| Body | sans | 14px | 400 | UI 일반 텍스트 |
| Mono inline | mono | 12-13px | 400 | 경로, 파일명, 코드 |
| Meta | mono | 11px | 400 | 시간, 라인 수 등 보조 정보 |

### 3.3 로고 규칙

```jsx
<span className="vibe-logo">
  vibe<span className="vibe-logo-dot">.</span>
</span>
```

```css
.vibe-logo {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 38px;
  letter-spacing: -0.8px;
  color: var(--vibe-ink);
}
.vibe-logo-dot {
  font-style: normal;          /* 마침표는 이탤릭 아님 */
  color: var(--vibe-accent);   /* 항상 악센트 */
}
```

- 마침표는 항상 `--vibe-accent`. 검정 마침표 금지.
- 로고 아래 최소 1.5x 라인높이 여백 확보.
- 앱 아이콘, 파비콘, macOS dock 아이콘에도 마침표 반영. 아이콘 SVG 업데이트 필요.

---

## 4. 컴포넌트 명세

### 4.1 `<ActionCard>` — 대시보드 최상단 액션 카드

3단 구조: label → primary value → meta + CTA.

```ts
interface ActionCardProps {
  label: string;                          // "AI SESSION"
  primary: string;                        // "2h ago" | "3" | "4"
  meta: string;                           // "Claude Code · 7 files, 2 docs"
  cta: string;                            // "review diff →"
  state: 'idle' | 'needs-action';
  onClick: () => void;
}
```

**스타일**
- Padding: 16px
- Border: 0.5px `--vibe-ink-faint`, radius 4px
- Background: `rgba(255,255,255,0.35)` (light) / `--vibe-paper-raised` (dark)
- `state === 'needs-action'`일 때 `primary`의 색상을 `--vibe-accent`로, 배경은 hover 시 `--vibe-accent-soft`
- Primary: serif 28px / 400
- Meta: mono 11px `--vibe-ink-muted`
- CTA: mono 11px `--vibe-accent`

### 4.2 `<MetaStrip>` — demoted 프로젝트 통계

한 줄 스트립으로 기존 4-box를 대체.

```jsx
<MetaStrip items={[
  { value: 111, label: 'files' },
  { value: 26,  label: 'folders' },
  { value: 6,   label: 'languages' },
  { value: 17,  label: 'docs' },
]} />
```

**스타일**
- 상하 `border: 0.5px solid var(--vibe-ink-whisper)`
- Padding: 10px 0
- 숫자 `--vibe-ink`, 라벨과 구분자 `--vibe-ink-muted`
- 구분자: ` · ` (`&middot;` with 10px 좌우 여백)

### 4.3 `<ActivityRow>` — 타임라인 한 줄

```ts
interface ActivityRowProps {
  actor: { type: 'ai' | 'user' | 'system'; label: string };
  timeAgo: string;                        // "2h ago"
  event: React.ReactNode;                 // "edited <FileLink>system-architecture.md</FileLink> + 6 files"
}
```

**컬럼**: dot(6px) · time(70px) · actor(104px) · event(flex)

**dot 색상**
- ai: `--vibe-accent`
- user: `--vibe-ink-muted`
- system: `--vibe-ink-faint`

**actor 색상**
- ai: `--vibe-accent`
- user: `--vibe-ink`
- system: `--vibe-ink-muted`

### 4.4 `<DocumentRow>` — 역할 기반 그룹의 문서 행

```ts
interface DocumentRowProps {
  name: string;
  lines: number;
  state: 'needs-review' | 'normal' | 'stale';
  summary?: string;                       // AI 편집 시간 or first content line
}
```

**state 시각화**
- needs-review: 좌측 6px `--vibe-accent` dot, summary에 "AI-edited 2h ago"
- normal: dot 없음, summary 없거나 파일 내 첫 문장
- stale: dot `--vibe-ink-faint`, summary "not edited in 30+ days"

---

## 5. 정보 아키텍처

### 5.1 대시보드 섹션 순서

1. **Header** — 로고, 경로, 브랜치 상태
2. **Needs review** (tier 1) — ActionCard × 3
3. **Meta-strip** (tier 3) — 프로젝트 통계 한 줄
4. **Recent activity** (tier 2) — ActivityRow × 4~6
5. **Documents** (tier 2) — 역할 기반 그룹

### 5.2 ActionCard 3종 (고정)

| 카드 | Primary | Meta 예시 | 계산 소스 |
|------|---------|-----------|-----------|
| AI SESSION | "2h ago" 또는 "none" | "Claude Code · 7 files, 2 docs" | `recent_sessions[0]` |
| REVIEW QUEUE | 숫자 | "AI-drafted docs pending" | `documents.filter(state == NeedsReview).length` |
| WORKING TREE | 숫자 | "modified · 1 ahead of main" | git2 `status` + `graph_ahead_behind` |

각 카드는 `state === 'needs-action'`일 조건:
- AI SESSION: 최근 세션에 대한 diff를 아직 사용자가 열람하지 않음
- REVIEW QUEUE: 1개 이상
- WORKING TREE: modified ≥ 1 또는 ahead ≥ 1

### 5.3 Document 이중 분류

각 문서는 두 차원으로 분류되며, 그룹핑은 **state 우선, role 차순**.

**Role (영속적, 경로 기반)**
- `Readme` — `/README*`, `/CHANGELOG*`, `/CLAUDE.md`
- `Spec` — `/docs/**/*.md`
- `Other` — 기타 `.md`

**State (일시적, 편집 이력 기반)**
- `NeedsReview` — `last_modified_by != User AND last_modified_at > last_opened_at`
- `Normal` — 기본
- `Stale` — 30일 이상 미수정

**그룹 표시 순서**
1. `Needs review` — state 기반, 비어 있으면 숨김
2. `Specs & architecture` — role == Spec
3. `Project readmes` — role == Readme
4. `Other` — 있을 때만

`Needs review`에 뜬 문서도 원래 role 그룹에는 중복 표시하지 않는다 (리뷰 완료 후 제자리로 복귀).

---

## 6. 백엔드 데이터 계약

### 6.1 프로젝트 스냅샷 타입

```rust
#[derive(Serialize)]
pub struct ProjectSnapshot {
    pub path: PathBuf,
    pub branch: String,
    pub working_tree: WorkingTreeStatus,
    pub counts: ProjectCounts,
    pub languages: Vec<LanguageShare>,
    pub documents: Vec<DocumentInfo>,
    pub recent_activity: Vec<ActivityEvent>,  // 최신순 최대 10개
    pub recent_sessions: Vec<AiSession>,      // 최신순 최대 3개
}

#[derive(Serialize)]
pub struct WorkingTreeStatus {
    pub modified: u32,
    pub staged: u32,
    pub untracked: u32,
    pub ahead: u32,
    pub behind: u32,
    pub is_clean: bool,
}

#[derive(Serialize)]
pub struct DocumentInfo {
    pub path: PathBuf,
    pub lines: u32,
    pub role: DocumentRole,
    pub state: DocumentState,
    pub last_modified_by: Actor,
    pub last_modified_at: SystemTime,
    pub last_opened_at: Option<SystemTime>,
    pub summary_line: String,                 // 첫 non-heading 라인, 80자 제한
}

#[derive(Serialize)]
pub enum DocumentRole { Readme, Spec, Other }

#[derive(Serialize)]
pub enum DocumentState { NeedsReview, Normal, Stale }

#[derive(Serialize)]
pub enum Actor {
    User,
    Ai { agent: String },                     // "Claude Code"
    External,                                  // formatter, git hook, etc.
}

#[derive(Serialize)]
pub struct AiSession {
    pub id: String,
    pub agent: String,
    pub started_at: SystemTime,
    pub ended_at: Option<SystemTime>,
    pub files_changed: Vec<PathBuf>,
    pub docs_changed: Vec<PathBuf>,
    pub acknowledged: bool,                   // 사용자가 diff 뷰 열었는지
}

#[derive(Serialize)]
#[serde(tag = "type")]
pub enum ActivityEvent {
    AiEdit  { session_id: String, path: PathBuf, at: SystemTime },
    UserEdit { path: PathBuf, at: SystemTime },
    Commit  { sha: String, message: String, at: SystemTime },
    BranchSwitch { from: String, to: String, at: SystemTime },
}
```

### 6.2 Actor 탐지 휴리스틱 (가장 어려운 부분)

vibe의 `notify` watcher가 파일 변경 이벤트를 받을 때, "User가 했는가, 외부 에이전트가 했는가"를 판별해야 한다. 세 가지 접근 중 v1에서는 A를 채택.

**접근 A — 프로세스/포커스 기반 (권장)**
- vibe 에디터에서 `save` 액션이 발생한 직후의 notify 이벤트 → User
- vibe 에디터에서 save 없이 발생한 notify 이벤트 → External
- External 이벤트가 60초 윈도우 내 3+ 파일에 걸쳐 발생 → AI Session으로 집약

**접근 B — 명시적 CLI 통합**
- Claude Code, Cursor 등이 `.vibe/sessions.log`에 에이전트명 기록
- 장점: 정확함. 단점: 생태계 협조 필요. 중기 과제.

**접근 C — 파일시스템 확장 속성**
- 저장 시 xattr 기록. 파일시스템 비호환으로 탈락.

**v1 정책**: A 단독, 10% 오분류 허용. 사용자가 "내가 한 건데?" 피드백 줄 경우 Phase 3에서 B 통합.

### 6.3 영속 상태 저장소

위치: `~/.config/vibe/state.json` (SQLite 검토는 Phase 4에서).

```json
{
  "projects": {
    "/Users/jungyeon/code/vibe": {
      "file_open_history": {
        "docs/product.md": "2026-04-17T14:32:00Z"
      },
      "session_acknowledgments": {
        "sess_abc123": "2026-04-18T10:01:22Z"
      }
    }
  }
}
```

`last_opened_at`은 파일이 vibe 뷰어에서 실제로 렌더링된 시점에 기록 (사이드바에서 스크롤만 한 경우 제외).

### 6.4 Tauri 커맨드

```rust
#[tauri::command]
fn get_project_snapshot(path: PathBuf) -> Result<ProjectSnapshot, String>;

#[tauri::command]
fn acknowledge_session(session_id: String) -> Result<(), String>;

#[tauri::command]
fn mark_document_opened(path: PathBuf) -> Result<(), String>;
```

대시보드는 `get_project_snapshot`을 (a) 앱 시작 시, (b) 파일 변경 이벤트 발생 시 debounce 1s 후, (c) 수동 `Ctrl+R` 시 호출.

---

## 7. 마이그레이션 / 단계별 출시

### Phase 1 — 비주얼 리프레시 (1주, v1.2.0)
- CSS 토큰 도입 (light + dark)
- 로고 타이포그래피 교체, 마침표 추가
- 앱 아이콘 / 파비콘 / DMG 배경 업데이트
- Languages 색상을 neutral 램프로 교체
- 4개 stat 박스 → `<MetaStrip>` 한 줄로 demote
- 월넛 다크 → Nightletter 다크로 교체
- **백엔드 변경 없음**. 기존 데이터 모델 그대로.

**성공 기준**: Claude.ai와 vibe를 나란히 스크린샷 찍었을 때 3초 안에 "다른 계보 제품"으로 읽힘.

### Phase 2 — 역할 기반 IA (2주, v1.3.0)
- 백엔드: `DocumentRole` 분류 (경로 기반, heuristic 아님)
- 프론트: 평면 Documents 리스트 → 역할 그룹핑 리스트
- 아직 Activity timeline 도입 안 함, 기존 "Recently Changed" 유지

**성공 기준**: 문서가 "파일 시스템 위치" 대신 "역할"로 읽힌다.

### Phase 3 — Activity & Sessions (3-4주, v2.0.0)
- 백엔드: Actor 탐지 휴리스틱 구현, 영속 상태 저장소 도입
- 백엔드: `recent_activity`, `recent_sessions` exposing
- 프론트: Activity timeline 섹션, ActionCard 3종
- 프론트: Needs review 그룹 활성화
- 포지셔닝 전환 공식화: "AI-native code viewer" → "AI-native project companion"

**성공 기준**: AI 세션 직후 vibe를 열었을 때 5초 안에 "AI가 뭘 건드렸고 내가 뭘 검토해야 하는지" 파악 가능.

### Phase 4 — 문서 온톨로지 (추후)
- Frontmatter 또는 sidecar를 통한 명시적 `draft/in-review/approved/archived` 상태
- Spec drift 탐지 (R&D 규모 큼)

---

## 8. 미해결 질문

1. **Iowan Old Style 라이선싱**: macOS 전용. Windows/Linux 대안 폰트 번들링 필요. EB Garamond Italic(OFL) 또는 Cormorant Italic(OFL) 검토. Phase 1 전 결정.
2. **Dark mode accent 톤**: 인디고 `#8FA3D8`이 AA는 통과하지만 "차가운 독서등" 정서에서 과하게 푸를 수 있음. 대안으로 aged brass(`#C4A87C`)가 있으나 Claude warm palette와 충돌 위험. 실제 디바이스 검증 필요.
3. **Third-party AI agent branding**: Claude Code vs Cursor vs Aider 구분 여부. v1은 "AI"로 통칭, Phase 3 후반에 per-agent 라벨 도입 검토.
4. **"Document"의 정의**: 현재 `.md` 한정. `.mdx`, `.rst`, `.org`, `.txt` 포함 여부. 보수적으로 `.md`만 시작, 사용자 요청 시 확장.
5. **File open history vs session ack의 상호작용**: 문서가 "needs review"일 때 열어서 닫으면 review queue에서 빠지는가? 권장: yes, 명시적 "acknowledge" 버튼 없이 열람만으로 소화된다고 간주. 대신 session-level ack은 별도 요구 (diff 뷰 클릭).

---

## 9. 참고 · 영감

- The New Yorker 마스트헤드 — 차가운 지면 위의 세리프 이탤릭 고전 사례
- Linear의 Activity feed — AI와 user를 구분 표시하는 actor semantics
- GitHub Pulse → GitHub Projects 진화 — "정적 통계"에서 "행동 유도 지표"로의 전환
- Arc Browser의 Library — 브라우저 히스토리를 "폴더"가 아닌 "역할"로 재조직한 사례
