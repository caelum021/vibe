# vibe — caelum 포크 안내

이 저장소는 [solpop-arch/vibe](https://github.com/solpop-arch/vibe)(원작자: solpop)의 **포크**입니다.
원본은 그대로 유지되며, 이 포크(`caelum021/vibe`)는 원본 위에 마크다운 편집/아웃라이너
기능을 추가한 버전입니다. 추가된 변경은 추후 원작자에게 Pull Request로 제안될 수 있습니다.

- **원본(upstream)**: https://github.com/solpop-arch/vibe
- **이 포크**: https://github.com/caelum021/vibe

---

## 설치 (Rust/빌드 도구 불필요)

미리 빌드된 macOS 앱을 [Releases](https://github.com/caelum021/vibe/releases)에서 받을 수 있습니다.

### 방법 A — 터미널 한 줄 (권장)

```bash
curl -fsSL https://raw.githubusercontent.com/caelum021/vibe/main/scripts/install-from-release.sh | bash
```

최신 릴리스의 앱을 내려받아 `/Applications`에 설치하고 바로 실행합니다.
Gatekeeper 격리 속성도 자동으로 제거합니다.

### 방법 B — 직접 다운로드

1. [Releases](https://github.com/caelum021/vibe/releases)에서 `vibe-macos-aarch64.zip`(또는 `.dmg`)을 받습니다.
2. 압축을 풀고 `vibe.app`을 `/Applications`로 옮깁니다.
3. 이 앱은 Apple 서명이 없어서 처음 실행 시 macOS가 차단할 수 있습니다.
   **`vibe.app`을 우클릭 → 열기 → 열기**를 누르면 이후로는 정상 실행됩니다.
   (또는 터미널에서 `xattr -dr com.apple.quarantine /Applications/vibe.app`)

> 참고: 현재 빌드는 Apple Silicon(arm64) 대상입니다. Intel Mac은 Rosetta로 동작합니다.

---

## 소스에서 직접 빌드 (개발자용, Rust 필요)

```bash
scripts/install.sh            # 릴리스 빌드 → /Applications 설치 → 실행
scripts/install.sh --no-open  # 빌드 + 설치만
```

`cargo tauri build`로 빌드한 뒤 `/Applications/vibe.app`을 교체합니다. Rust + Tauri 환경이 필요합니다.

---

## 원본 대비 추가된 기능

원작자 버전(`solpop-arch/vibe`) 대비 이 포크에 추가된 내용입니다.

### 멀티탭 & 편집
- **멀티탭 편집** — 여러 파일을 탭으로 동시에 열고 편집
- **더블클릭으로 편집 모드 진입**, 편집기 줌(Cmd +/-/0)
- **Cmd+W**가 앱을 종료하지 않고 **현재 탭만 닫도록** 수정
- 편집 모드에서 **줄바꿈(line wrap) 기본 활성화**

### 마크다운 아웃라이너 키맵
- **Tab / Shift+Tab** — 목록·헤딩 들여쓰기/내어쓰기 (하위 항목 포함)
- **Cmd+↑ / Cmd+↓** — 목록 항목 순서 이동
- **Cmd+↑ / Cmd+↓ 상위 레벨 넘나들기** — 같은 레벨 형제가 없으면 부모 레벨을
  뛰어넘어 이동. 타겟 위치에 맞게 레벨이 조정되며, 항목의 레벨은 올라가기만 하고
  더 깊어지지는 않음
- **Enter로 목록 자동 이어쓰기** — 불릿/번호/체크박스 마커를 다음 줄에 이어줌
  (빈 항목에서 Enter 시 목록 종료)
- **체크박스 클릭 토글** — `- [ ]` / `- [x]`를 클릭으로 전환

### 대시보드
- **문서 섹션 재구성** — 고정(pinned) / 최근(recent) / 폴더별(by-folder) 구조

### 빌드/설정 수정
- `tauri.conf.json`의 `beforeDevCommand`/`beforeBuildCommand` 경로 오류 수정
  (`cd ../client` → `cd client`)
- `.bkit/` 플러그인 상태 무시, 번들 식별자 정리

전체 커밋 목록은 `git log origin/main..main`으로 확인할 수 있습니다.

---

## 두 버전의 관계

- 이 포크에 올린다고 원본이 바뀌지 않습니다. **둘은 독립적으로 유지**됩니다.
- 원작자에게 변경을 제안하려면, 이 포크에서 원본으로 **Pull Request**를 엽니다
  (GitHub의 포크 페이지에서 "Contribute" → "Open pull request").
- 원본의 최신 변경을 이 포크로 가져오려면:
  ```bash
  git fetch origin
  git merge origin/main   # 또는 git rebase origin/main
  ```
