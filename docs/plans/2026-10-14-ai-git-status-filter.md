# AI Git Status Filter

## Goal

AI root에 base directory를 지정하면 지금은 하위 Markdown 전체가 Explorer와 Document List에 나온다. AI가 문서를 많이 고친 뒤에는 무엇이 바뀌었는지 찾기 어렵다. git status를 기준으로 `All / Modified / New` 필터를 제공해, 변경된 문서만 골라 보고 기존 View diff로 바로 확인할 수 있게 한다.

## 현재 상태

- `scan_docs_root`(`src-tauri/src/library.rs:141`)는 `.gitignore`/`.ignore`를 존중해 Markdown만 scan하고, folders는 문서 경로에서 파생한다(`library.rs:170-178`). gitignored 파일은 이미 목록에 없다.
- `git_read_only()`(`library.rs:241`)는 `-C root -c core.fsmonitor=false --no-optional-locks`로 read-only git을 실행한다. `git_head_baseline()`은 macOS CLT 미설치 시 GUI prompt를 막는 `xcode-select -p` guard를 먼저 수행한다.
- View diff는 HEAD 기준이다. `git show HEAD:./path`가 실패하면 `untracked`로 취급한다(`library.rs:285`). 따라서 staged 신규(`A`)와 rename 대상 경로도 diff에서는 untracked다.
- `git status --porcelain=v1`의 경로는 subdirectory에서 실행해도 repo root 기준이다. AI root 기준 경로를 얻으려면 `git rev-parse --show-prefix`를 제거해야 한다(2026-10-14 git 2.56.0으로 확인).
- 모든 Tauri command는 sync `pub fn`이다. Tauri 2에서 sync command는 main thread에서 실행된다.
- scan은 Refresh 버튼, root 활성화, mutation 후에만 다시 실행된다. window focus나 file watch 기반 자동 갱신은 없다.
- Document List는 선택 folder의 direct Markdown children만 보여준다(`useLibraryWorkspace.ts:291-296`). folder 선택과 펼침 상태는 root별 runtime-only다(`App.tsx:596-602`, `:1090-1095`).
- AI folder pane header는 `Folders` 제목만 있고 오른쪽 action 자리가 비어 있다(`App.tsx:1371-1381`).

## Behavior

1. 별도 git mode 토글은 없다. active AI root가 git work tree 안에 있으면 필터 컨트롤을 표시하고, git이나 repository를 사용할 수 없으면 숨긴다(diff toggle과 같은 원칙). 기본값 `All`은 현재 동작과 같고, "git mode"는 필터가 `All`이 아닌 상태를 뜻한다. `All`에서는 work-tree 판별만 하고 status 전체는 읽지 않는다.
2. 필터는 `All | Modified+New | Modified | New`이고 HEAD를 기준으로 나눈다. View diff와 같은 기준이다. `Modified+New`는 아래 두 bucket의 합집합이다.
   - Modified: HEAD에 같은 경로가 있고 내용이 다른 문서. staged/unstaged를 구분하지 않는다(` M`, `M `, `MM`, `T`).
   - New: HEAD에 그 경로가 없는 문서(`??`, staged `A`, rename 대상 경로 `R`).
   - 디스크에 없는 삭제 문서(`D`)는 열 수 없으므로 어느 bucket에도 넣지 않는다.
   - root 안의 nested repo는 git status에 `?? dir/` 한 줄로 나타난다. 같은 HEAD 기준으로 그 아래 문서는 `New`이며, View diff도 전체 추가로 표시하므로 일치한다.
3. 필터는 Explorer tree와 Document List 양쪽에 적용된다.
   - Explorer tree: 해당 bucket 문서만 남기고, folder는 남은 문서를 포함하는 branch만 표시한다.
   - Document List: `All`이 아니면 선택 folder 하위 전체(recursive)의 해당 문서를 표시하고, 각 행에 선택 folder 기준 상위 경로를 muted로 붙여 같은 이름 문서를 구분한다. root 선택 상태면 root 전체의 변경 문서 목록이 된다. `All`은 기존대로 direct children만 표시한다.
4. 필터 중 tree는 임시 view다.
   - `All`이 아닌 필터로 전환하면 남은 branch를 모두 펼쳐 표시한다. 필터 중 펼침/접힘은 기존 root별 펼침 상태와 분리된 runtime state에 둔다.
   - 선택 folder가 필터로 숨겨지면 root 선택으로 표시하되, 원래 선택을 버리지 않는다.
   - `All`로 돌아오면 필터 전의 펼침 상태와 선택 folder를 그대로 복원한다.
5. 필터 컨트롤은 Document List header의 cycle icon button 하나다.
   - click마다 `All → Modified+New → Modified → New → All`로 순환하고 `Modified+New`는 두 bucket icon을 함께 표시한다. `All`이 아니면 `data-active`로 AI accent 강조한다. current/next state를 설명하는 `aria-label`·tooltip을 제공한다.
   - AI header 순서는 `Refresh → Filter → Sort → Density → Create`가 된다. Human과 git work tree가 아닌 AI root는 기존 `Refresh → Sort → Density → Create`를 유지한다.
   - list pane은 3-pane/2-pane 모두에서 보이므로 별도 fallback이 없다. content-only에서는 보이지 않지만 필터 상태는 유지된다.
   - header 제목 옆 count는 필터 중 `5 changed` / `3 modified` / `2 new`처럼 bucket을 표시한다.
6. 필터 선택은 모든 AI root가 공유하는 하나의 runtime-only 상태(`docsRuntime.gitFilter`)다. root를 활성화하면 그 root의 git status가 work tree를 확인한 뒤 공유 필터를 적용하고, work tree가 아닌 root는 전체 문서를 보여주고 컨트롤을 숨기되 공유 필터는 바꾸지 않는다. 필터 전 선택 folder와 필터 중 접힘 상태는 각 root의 `docsRuntime.navigation` 기록에 남아, `All`로 돌아가면 각 root가 자기 선택을 복원한다. 앱 재시작 시 `All`로 시작하며 `settings.json` 스키마는 바뀌지 않는다.
7. git status는 필터를 `All`에서 다른 필터로 바꿀 때, 그리고 필터가 `All`이 아닌 동안 scan과 같은 시점(Refresh, root 활성화, mutation 후 재scan)에만 읽는다. `All`에서는 work-tree 판별만 한다(1번). 저장 후나 window focus 시에는 다시 읽지 않는다. 필터 목록은 "마지막 Refresh 시점의 상태"이며, 앱에서 편집한 기존 문서의 bucket 변화는 다음 Refresh 때 반영된다. active 문서가 현재 bucket에 없으면 Document List에 선택 row가 없을 수 있고, tab은 그대로 유지한다.
8. git 명령은 read-only만 사용한다. mutating git 명령은 어떤 경우에도 실행하지 않는다.

## Non-goals

- Human space에는 필터를 제공하지 않는다.
- 여러 repo를 담은 상위 폴더처럼 root 자체가 git work tree가 아니면 필터를 숨긴다. 하위 repo별 status 집계는 하지 않는다.
- submodule 내부 문서는 분류하지 않는다(`All`에서만 보인다).
- `All`에서 행별 `M`/`N` badge를 표시하지 않는다.
- staged/unstaged 구분, stage·commit 등 git 쓰기 동작을 제공하지 않는다.
- HEAD 외 branch나 commit과의 비교를 제공하지 않는다.
- file watch나 window focus 기반 자동 갱신을 하지 않는다.

## Planning hints

- 새 command `read_git_status(root)`는 `scan_docs_root`와 분리한다. git 실패가 scan을 깨지 않게 한다.
- `git_read_only()` 재사용: `status --porcelain=v1 -z --untracked-files=all -- .` + `rev-parse --show-prefix`. `-z` rename entry는 경로가 두 개다.
- `xcode-select` guard와 work-tree 확인은 `git_head_baseline()`과 공유한다.
- 큰 repo에서 main thread가 멈추지 않도록 이 command는 async로 만든다.
- Frontend는 documents만 필터하고 folders를 남은 문서 경로로 재계산한다.
- 계약 갱신 대상: `CLAUDE.md`, `docs/specs/intent-memo.md`, `DESIGN.md`, README.

## Open questions

_None._

## Decision Log

2026-10-14 · Q1 진입 방식 → A. 별도 토글 없이 work tree 감지 시 필터 자동 노출, 기본 `All` · diff toggle과 같은 노출 원칙, `All`이 현재 동작이라 끌 필요 없음
2026-10-14 · Q2 필터 bucket 정의 → A. HEAD 기준 `All | Modified | New` · View diff의 HEAD baseline 분류와 항상 일치
2026-10-14 · Q3 필터 적용 시 Document List 범위 → A. `Modified`/`New`에서 선택 folder 하위 recursive + 상위 경로 표시, 필터는 Explorer folder에도 적용 · 여러 folder에 흩어진 AI 변경을 한 목록에서 검토
2026-10-14 · Q4 필터 전환 시 tree 상태 → A. 필터 중 자동 펼침 + 숨겨진 선택은 root로 표시, `All` 복귀 시 원래 펼침·선택 복원 · 필터된 tree는 작고, 잠깐 보고 끄는 사용 패턴에서 탐색 위치를 잃지 않음
2026-10-14 · Q5 컨트롤 위치와 모양 → A. list header cycle icon button, 순서 `Refresh → Filter → Sort → Density → Create` · 기존 3-state 컨트롤(Density, diff)과 같은 패턴, 3/2-pane 공통 위치라 fallback 불필요
2026-10-14 · Q6 필터 상태 저장 → A. root별 runtime-only, 재시작 시 `All` · 선택·펼침과 같은 navigation 기록이라 Q4 복원을 한곳에서 처리, 재시작 후 필터된 목록으로 인한 혼란 방지, settings 스키마 불변
2026-10-14 · Q7 status 갱신 시점 → A. scan 시점 + `All`에서 필터 전환 시에만, 저장/focus 시 재조회 없음 · 기존 "마지막 Refresh 시점" 원칙 유지, 검토 중 목록 안정, autosave마다 git 실행 없음
2026-10-14 · Q8 v1 범위와 non-goals → A. 제안 목록 그대로 확정 · v1은 diff toggle과 같은 "root 하나 = repo 하나" 범위, 상위 폴더 집계와 `All` badge는 후속
2026-10-14 · Q9 Modified+New 통합 보기 → 4단계 순환 `All → Modified+New → Modified → New → All`, 통합 상태는 두 icon 표시 · 리뷰 시 둘을 함께 보는 경우가 많아 1 click으로 도달, 개별 bucket 보기는 유지 (왕복 click 수는 끝에 둘 때와 동일)
2026-10-14 · Q10 필터 상태 범위 변경 → Q6을 대체해 모든 AI root가 하나의 runtime-only 필터를 공유 · 사용자 요청("folder 전체에 대해서 모드 설정"), 선택·펼침 복원은 root별 navigation에 그대로 둠
