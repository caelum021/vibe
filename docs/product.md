# Vibe — Product Overview

## vibe란 무엇인가

AI와 코딩할 때, 실제 협업은 문서를 통해 이루어진다. 스펙을 쓰고, AI 결과물을 diff로 확인하고, 파일을 고쳐서 방향을 잡는 흐름. 기존 IDE는 디버깅·컴파일에 최적화되어 있지만 AI 협업에서는 그게 필요 없다. Vibe는 문서 작성·편집·변경 맥락 파악에만 집중하는 경량 데스크톱 앱이다.

## 누구를 위한가

AI CLI(Claude Code, Gemini CLI 등)로 코딩하는 개발자. AI가 코드를 바꾸면 Vibe에서 바로 확인하고, 직접 고쳐서 방향을 잡는다.

## 핵심 원칙

- **문서가 인터페이스.** AI와의 협업은 코드가 아니라 문서를 통해 이루어진다.
- **디버거·컴파일러 없음.** AI 협업에 필요 없는 기능은 없앤다.
- **차분한 도구.** 집중을 방해하지 않는다. 알림보다 subtle 인디케이터, 모달보다 인라인.
- **단순함 우선.** "이거 없으면 정말 불편한가?" 먼저 묻는다.
+ **마크다운 1급 시민.** 코드 파일과 동등하게, 또는 그 이상으로 md 파일을 잘 다룬다.

---

## 릴리스 히스토리

### v1.0.0 — 첫 릴리스

- 파일 탐색 (트리, 키보드 네비게이션, 생성/삭제/이름변경)
- 마크다운 렌더링 뷰어 + 편집 + 프리뷰 토글
- 코드 구문 강조 뷰어 (react-window 가상화, 대용량 파일 지원)
- Git diff (inline/side-by-side) + 파일별 상태 배지 + 자동 갱신
- 프로젝트 대시보드 (언어 분포, 문서 목록, 최근 변경)
- 멀티 프로젝트 전환 (Cmd+1-9)
- 파일 감시 + 자동 갱신
- GitHub Actions CI/CD (태그 푸시 → 자동 빌드/배포)

### v1.0.1 — 버그 수정 & 안정화

- 대시보드 데이터 정확성 + 자동/수동 갱신 개선
- 편집 모드 외부 변경 감지 (ref 기반)
- 편집 모드 줄번호 스크롤 동기화
- Space/Shift+Space 페이지 스크롤
- 타이틀바 프로젝트명 표시
- 드래그/복사 절대경로
- 대시보드 문서 그룹 접기/펼치기

### v1.0.2 — 뷰어 사용성 & 대시보드 개선

- 자체 검색 (Ctrl+F) — 코드·마크다운 모두, 하이라이트 + 이동
- Copy All 버튼 (가상화 뷰어 전체 복사)
- 편집 모드 wrap toggle (Ctrl+W)
- 뷰→편집 진입 시 스크롤 위치 유지
- 대시보드 문서 고정(Pinning) — 자주 쓰는 문서를 상단에 고정
- About 모달 (앱 정보, git badge 색상 범례)
- 5색 git 뱃지 (added/untracked/modified/deleted/renamed 구분)
- 대시보드 문서 description 자동 추출 (첫 단락 미리보기)
- 디자인 시스템 정렬 (사이드바 220px, border-radius, warm black)

### v1.1.0 — 마크다운 1급 시민화

프로젝트 내 md 문서 간 관계(링크 그래프, 백링크)를 1급 시민으로 다룬다. 마크다운 도구의 진짜 가치는 렌더링이 아니라 **그래프와 백링크**라는 판단 — 설계문서는 본질적으로 의존성 그래프이기 때문. `project-brief` → `dev-plan` → `phase-work-order`처럼 문서 간 관계가 설계의 구조 그 자체다.

- 링크 그래프 인프라 (Rust 백그라운드 인덱스 + watcher 증분 갱신)
- 문서 간 링크 탐색 (내부 md 링크는 뷰어에서, 외부 URL은 OS 브라우저, `↗` 마커)
- 백링크 패널 (뷰어 하단 "이 문서를 참조하는 문서")
- 끊어진 링크 인라인 표시 (점선 밑줄 + 네이티브 툴팁, broken 이미지 placeholder)
- 대시보드 Broken Links / Orphan Docs 섹션 (0건이면 숨김)
- 파일 열람 히스토리 (⌘[ / ⌘] / ⌘← / ⌘→) + per-entry 스크롤 위치 기억
- 브랜딩 cool-shift 팔레트 + `vibe.` 로고 마침표 + 앱 아이콘 재생성

### v1.2.0 — 링크 그래프 시각화 & 뷰어 안정화

v1.1.0에서 만든 링크 인덱스를 대시보드에 시각화. 문서 의존성을 한눈에 본다. 큰 파일 안정화 + 마크다운 소프트 줄바꿈 + 라이선스 전환을 함께.

- 대시보드 미니 그래프 — force-directed, root-left / deeper-right 계층 힌트, 노드 클릭으로 파일 열기 (200-node cap)
- 그래프 click-to-interact (wheel-zoom이 페이지 스크롤을 가로채지 않음) + 라벨 폭 기반 collide
- 격리 문서(in=0, out=0)는 그래프에서 제외 — Orphan Docs 패널이 이미 노출 중
- 뷰어 파일 크기 한도 1MB → 2MB, 1MB 초과 시 plain row fallback, 첫 read 로딩 인디케이터
- remark-breaks — 단일 줄바꿈을 `<br>`로 렌더 (Obsidian/GitHub 관례)
- 라이선스 MIT → Mozilla Public License 2.0

---

## 다음 버전 — 마크다운 기능 확장

v1.1.0의 링크 그래프 인프라 위에 올릴 수 있는 후속 기능들. 우선순위는 실제 사용 피드백 이후 재조정. (v1.2.0에서 "미니 그래프 뷰" 구현 완료.)

### 우선순위 중간

**헤딩 아웃라인**
md 파일 열면 H1/H2/H3 트리 표시, 클릭 시 해당 위치로 점프.

**프로젝트 전체 md 풀텍스트 검색**
docs/ 전체에서 키워드 검색.

**Mermaid 다이어그램 렌더링**
설계문서 시퀀스/플로우차트 지원.

### 차별화 — vibe만 할 수 있는 것

**코드-문서 양방향 링크**
md 문서가 `src/components/Chart.tsx`를 언급하면 링크로 인식. 코드 파일에서 "이 파일을 참조하는 설계문서" 역추적. 순수 노트 도구로는 불가능 — vibe는 프로젝트 전체(코드 + 문서)를 보기 때문에 가능하다.

**AI CLI 컨텍스트 추천**
`phase2-work-order.md`를 열면 상위 문서(`dev-plan.md`, `project-brief.md`)도 컨텍스트에 넣을지 제안. 설계문서 체인을 따라가야 제대로 된 작업이 나오는 경우가 많다.

## 브랜딩 방향 (v1.1.0 동행)

Claude(warm cream/coral) 계열과의 시각적 혼동을 줄이기 위한 최소 개편을 v1.1.0 트랙과 함께 진행한다. 팔레트·폰트·IA 전면 교체가 아니라, 기조("차분한 도구", "문서가 인터페이스")는 유지한 채 브랜드 포인트만 정돈.

- **팔레트 cool-shift** — neutral chroma 살짝 감소, rust accent 유지. 상세는 [`design/design.md`](./design/design.md) "Palette — Cool-shift" 섹션.
- **로고 마침표** — `vibe` Instrument Serif italic 끝에 accent 색 `.` 추가. 앱 아이콘·파비콘·DMG·About 모달 일관 반영.

대시보드 전면 개편안(ActionCard, Activity timeline, Actor 탐지, cool ink/paper 전체 전복)은 [`design/vibe-design-system-v2-proposal.md`](./design/vibe-design-system-v2-proposal.md)에 **deferred로 보관**. markdown 1급 시민 기능(그래프 뷰, 링크 탐색 등)이 새로운 surface를 만들면 그때 이 제안서를 재료로 꺼내 재설계한다. 지금은 조용한 도구 기조가 우선.

## 다음 버전 후보 — 문서 구조 온보딩 (제안)

원래 v1.2.0 후보로 두었던 방향. v1.2.0은 링크 그래프 시각화로 진행했고, 이 제안은 다음 버전 후보로 보존.

새 프로젝트를 열었을 때 AI 협업에 필요한 문서 구조를 Vibe가 자동으로 제안한다. 각자 튜닝해서 만들려면 시간이 걸리는 부분을 대신 깔아주는 것.

- CLAUDE.md 부재 감지 → 템플릿 생성 제안
- `docs/` 구조 (dev / architecture / design) 스캐폴딩
- 사용자 커스텀 템플릿 지원

---

## 링크 파싱 시 고려할 케이스

- 상대경로: `[x](./foo.md)`, `[x](../bar/baz.md)`
- 절대경로: `[x](/docs/foo.md)` (프로젝트 루트 기준)
- 앵커 포함: `[x](./foo.md#section)` — 파일은 열고 앵커는 별도 처리
- 앵커만: `[x](#section)` — 같은 문서, 링크로 처리하지 않음
- 이미지: `![](./img.png)` — 링크 그래프에서 제외
- 코드블록 내부 링크는 무시 (예시 코드일 수 있음)

`remark` / `unified` AST 순회로 link 노드만 추출하면 엣지 케이스 직접 처리 안 해도 됨.

---

## 문서 지도

| 문서 | 역할 |
|---|---|
| **[이 문서]** | 제품 정의, 원칙, 방향 — 모든 문서의 루트 |
| [`dev/dev-log.md`](./dev/dev-log.md) | 페이즈별 개발 히스토리 + 다음 계획 |
| [`dev/phase5-v1.0.2-viewer-usability.md`](./dev/phase5-v1.0.2-viewer-usability.md) | v1.0.2 뷰어 사용성 + 대시보드 개선 스펙 (완료) |
| [`architecture/system-architecture-v1.0.0.md`](./architecture/system-architecture-v1.0.0.md) | 시스템 아키텍처 (Tauri, Rust 백엔드, React 구조) — v1.0.0 기준 |
| [`architecture/git-status-badges.md`](./architecture/git-status-badges.md) | git 상태 배지 전체 흐름 (Rust→JS→Explorer, 5색 분류, dirtyDirs) |
| [`design/design.md`](./design/design.md) | 디자인 시스템 (색상, 타이포, 컴포넌트 스펙) — 현 시스템 |
| [`design/vibe-design-system-v2-proposal.md`](./design/vibe-design-system-v2-proposal.md) | 대시보드·IA 전면 개편 제안 — deferred. markdown 기능 확충 이후 재논의 |
