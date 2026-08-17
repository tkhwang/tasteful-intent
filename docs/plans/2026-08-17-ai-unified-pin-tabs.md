# AI 단일 Mode + Pin Tab 설계

> 이 문서는 `docs/plans/2026-08-15-ai-pinned-roots.md`의 전역 `일반 | 고정` mode 계약을 대체한다.
>
> 구현은 먼저 `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`의 기존 Browse/Pinned 계약을 이 문서와 동기화한 뒤 product code를 변경한다.

**Goal:** AI 공간의 전역 `일반 | 고정` mode를 제거한다. AI는 단일 mode에서 사용자가 선택한 폴더들을 folder tab으로 열고, 열린 tab을 pin하면 label을 부여해 `[A]`로 표시한다. pin은 전역 정책이 아니라 tab 속성이다.

**Why:** 기존 설계에서 두 mode의 실질 차이는 label 유무뿐이었다. 둘 다 여러 root 유지, root별 독립 session, 재시작 복원, missing root 유지, 동일 scanner/Explorer를 공유한다. 그 작은 차이를 위해 전역 mode selector, 이중 session namespace, mode 전환 save barrier, 첫 진입 mode 선택을 지불했고, 좁은 sidebar에서 mode selector가 label shortcut 공간을 잠식했다. mode를 없애면 구조와 UI가 모두 단순해진다.

## 확정 결정

1. **전역 mode 제거.** `docsSourceMode`와 `일반 | 고정` selector를 삭제한다. AI workspace는 단일 ordered folder tab 목록이다.
2. **Folder-first 유지.** `AI 폴더 열기` 하나로 시작하며 directory picker만 사용한다. 개별 파일 picker로 AI workspace를 만들지 않는다.
3. **Pin은 tab 속성.** 열린 folder tab을 pin하면 label을 부여하고 pinned tab이 된다. `label !== null` ⟺ pinned.
4. **Pin 순서 불변식.** 목록은 pinned tab들이 앞, 일반 tab들이 뒤다. pin하면 pinned group 맨 뒤로 이동하고, unpin하면 일반 group 맨 앞으로 이동한다.
5. **닫기 보호.** 일반 tab만 close affordance를 가진다. pinned tab을 닫으려면 먼저 unpin해야 한다.
6. **Unpin은 비파괴.** unpin은 label만 제거하고 tab과 root-local session은 유지한다. 확인 dialog가 필요 없다. 파괴적 동작은 일반 tab 닫기(해당 root session 제거)뿐이다.
7. **Custom label 규칙 유지.** pin 시 label dialog가 folder basename의 앞 1~2 grapheme를 editable 기본값으로 제안하고, trim 후 `Intl.Segmenter` 기준 1~2 grapheme만 제출할 수 있다. label 중복은 허용하며 identity는 canonical root다.
8. **Label 수정.** pinned tab menu의 `Edit label`은 동일 validation으로 label만 변경한다. root, 순서, active root, session은 유지한다.
9. **중첩 제한 폐기.** exact canonical match는 새 tab 추가가 아니라 기존 tab 활성화다. ancestor/descendant 관계의 root는 일반·pinned 모두 허용한다(기존 일반 mode와 동일). 활성 root 하나만 runtime buffer를 가지므로 충돌은 기존 save barrier가 담당한다.
10. **임의 위치 허용.** 사용자가 선택한 visible non-symlink canonical folder라면 위치와 repository 여부를 제한하지 않는다.
11. **Missing root 유지.** 사라진 root의 tab, label, session을 자동 삭제하지 않는다. unavailable 상태로 유지하고 같은 canonical path가 복구되면 refresh로 session을 복원한다. pinned/일반 공통이다.
12. **3-pane 유지.** `Explorer | Document List | Content` 구조와 read-only AI 원칙(구조 mutation 없음)은 변경하지 않는다.
13. **Explorer root row.** pinned root는 `[A] basename`, 일반 root는 `basename`으로 표시한다(기존 규칙 유지).
14. **제품 용어.** mode selector 용어(`일반 | 고정`, `Browse | Pinned`)를 폐기한다. 동작 용어는 English `Pin / Unpin / Edit label`, 한국어 `고정 / 고정 해제 / Label 수정`이다.
15. **컴포넌트 경계.** 통합 Source Card는 `DocsRootSwitcher.tsx`가 단독 소유하고 `PinnedRootsSwitcher.tsx`는 제거한다. `FileExplorerTree.tsx`와 Human `FolderTree.tsx`는 유지한다.

## 데이터 모델 · 영속화

- `settingsSchemaVersion: 2`: 아래 통합 AI folder-tab schema를 식별한다. 동일 이름의 legacy key와 shape를 추측으로 구분하지 않고 version을 먼저 확인한다.
- `docsRoots: { root: string; label: string | null }[]`: 열린 canonical root의 순서 목록. `label !== null`이면 pinned이며 pinned entry가 목록 앞쪽에 온다. canonical root가 identity다.
- `docsRoot: string | null`: 활성 root이며 `docsRoots`에 속해야 한다.
- `tabSessions.docs: Record<string, { paths, activePath }>`: root별 단일 document session namespace. `docsRoots`에 없는 root의 session은 폐기한다.
- label은 trim 후 1~2 grapheme 검사를 통과해야 한다. 저장값의 label이 검사에 실패하면 entry와 session은 보존하되 `label: null`(일반 tab)로 정규화한다.
- pinned-first 순서가 깨진 저장값은 로드 시 pinned group 우선으로 안정 정렬해 복구한다.
- Pinned/일반 공통으로 Explorer의 selected/expanded state와 root availability는 앱 실행 중 root별 runtime map으로만 유지한다. availability는 settings에 저장하지 않는다.
- settings 변경은 version 2 snapshot 저장이 성공한 뒤에만 React state와 `settingsRef`에 반영한다. 저장 실패 시 이전 in-memory settings와 mounted workspace를 유지한다.

### 기존 필드 migration

- 판별: `settingsSchemaVersion === 2`일 때만 `docsRoots` object entry와 root-indexed `tabSessions.docs`를 통합 schema로 읽는다. version이 없거나 2보다 낮으면 기존 migration 입력으로 처리한다.
- 현재 Browse/Pinned 읽기: `docsPinnedRoots`(pin 순서, label 유지) 뒤에 `docsBrowseRoots`(tab 순서, `label: null`)를 이어 붙여 `docsRoots`를 만든다. 동일 canonical root가 양쪽에 있으면 pinned entry만 유지한다.
- leapfrog legacy 읽기: 현재 Browse/Pinned field가 없으면 기존 `docsRoots: string[]`, `docsRoot`, 단일 `tabSessions.docs: { paths, activePath }`를 현재 parser 계약대로 먼저 승격한 뒤 version 2 schema로 통합한다. current field와 legacy field가 함께 있으면 current field가 우선한다.
- session: `tabSessions.docsPinned`와 `tabSessions.docsBrowse`를 `tabSessions.docs`로 병합한다. 동일 root가 양쪽에 있으면 마지막 유효 `docsSourceMode`의 session을 preferred로 삼고, preferred `paths` 뒤에 다른 session의 `paths`를 중복 없이 이어 붙인다. `activePath`는 preferred의 유효한 값을 우선하고 없으면 다른 session의 유효한 값을 사용한다. 저장된 mode가 없거나 유효하지 않으면 현재 parser 계약대로 Browse를 preferred로 사용한다.
- active: 마지막 `docsSourceMode`의 active root(`docsPinnedRoot` 또는 `docsBrowseRoot`)가 `docsRoots`에 있으면 사용하고, 없으면 첫 entry, 그것도 없으면 `null`이다.
- 저장: version 2 통합 snapshot을 성공적으로 저장한 뒤 `docsSourceMode`, `docsBrowseRoots`, `docsBrowseRoot`, `docsPinnedRoots`, `docsPinnedRoot` legacy top-level key를 store에서 실제 delete한다. `tabSessions`는 version 2 전체 object로 교체해 `docsBrowse`, `docsPinned`을 제거한다. 사용자 파일은 건드리지 않는다.

### 결정 기록

- **Decision 1 — 통합 settings 식별 전략: resolved A.** `settingsSchemaVersion: 2`를 discriminator로 추가하고 `docsRoots`, `docsRoot`, `tabSessions.docs`를 최종 key로 재사용한다. version 없는 동일 이름 legacy shape는 별도 migration 입력으로만 취급한다.
- **Decision 2 — 동일 root session 병합: resolved A.** Browse/Pinned 양쪽의 열린 tab 경로를 preferred-mode-first stable union으로 보존하고 active path만 preferred mode 우선으로 결정한다.
- **Decision 3 — 기존 missing tab 선택 실패: resolved A.** 현재 workspace/settings를 유지하고 대상 tab만 unavailable로 표시한다. targeted Refresh가 성공한 뒤에만 해당 root를 활성화하고 session을 복원한다.
- **Decision 4 — Folder tab action menu trigger: resolved A.** root 선택 button과 전용 ellipsis menu button을 분리한 split control을 사용한다.
- **Decision 5 — 구현 Task 문서 위치: resolved A.** 실행 계획은 `docs/plans/2026-08-17-ai-unified-pin-tabs-implementation.md`에 별도로 작성하고 이 문서는 설계 계약만 유지한다.

## Native boundary · scan

- native command 변경 없음. directory picker 결과는 canonical-root validation을 통과시키고, 모든 tab이 동일한 AI read-only scan command(`.gitignore`/`.ignore`, hidden, symlink 제외)를 사용한다.
- `useLibraryWorkspace`의 initial restore, Refresh, current-document reload는 모두 주입받은 scanner를 사용한다. AI reload가 Human `scanLibrary`를 직접 호출하지 않는다.
- Human `scan_library`와 mutation 동작은 변경하지 않는다.
- scan 실패는 빈 snapshot으로 session을 덮어쓰지 않는다.

## UI 계약

### 첫 AI 진입

- mode 선택 화면을 제거한다. `AI 폴더 열기` 단일 action이 directory picker를 연다.

### Source Card

- AI Source Card는 pinned shortcut header와 모든 열린 root를 담는 bounded path list로 구성한다. path list는 최대 네 줄까지 늘어나고 그 이상은 card 내부에서 세로 scroll한다.
- **Header:** pinned label shortcut group `[A] [B] …` + 후행 `AI 폴더 열기` action. 활성 root가 pinned면 해당 label에 활성 표시를 한다.
- **Path list:** pinned 여부와 관계없이 모든 root를 저장 순서대로 한 줄씩 표시한다. visible path는 `…/parent/leaf`, pinned row는 `label | …/parent/leaf` 형식이며 tooltip과 accessible name은 canonical full path를 유지한다.
- 각 path row는 root를 즉시 활성화하는 primary button, 항상 enabled인 direct Pin toggle, root를 전환하지 않는 전용 ellipsis action-menu button을 분리한다. unpinned Pin은 muted outline, pinned Pin은 AI accent와 filled icon으로 표시한다.
- direct Pin toggle은 unpinned에서 label dialog를 열고, pinned에서는 확인 없이 즉시 Unpin한다.
- pinned root의 ellipsis menu는 `Edit label`, unpinned root의 menu는 `Close`만 제공하며 unavailable root에는 해당 root를 대상으로 하는 `Refresh`를 추가한다.
- label이 중복되어도 각 control의 tooltip/accessible name은 folder basename과 canonical full path를 포함한다.
- ellipsis button은 root basename과 canonical path를 포함한 accessible name, `aria-haspopup="menu"`, `aria-expanded`를 제공한다. menu open 시 첫 item에 focus하고 ArrowUp/ArrowDown/Home/End로 이동하며 Enter/Space로 실행한다. Escape와 outside click은 닫고 opener에 focus를 복원한다.
- `Pin` dialog confirm과 cancel은 기존 root의 direct Pin toggle로, `Edit label` dialog는 ellipsis opener로 focus를 복원한다. `Unpin`은 행이 이동한 동일 root의 Pin toggle, `Close`는 right-then-left 인접 root의 ellipsis opener, 남은 root가 없으면 `AI 폴더 열기` action으로 focus를 복원한다.
- 두 pane 접힘 상태의 navigation fallback은 기존 규칙(2-pane은 AI controls 유지, content-only는 없음)을 따른다.

### Label dialog

- pin: unpinned path row의 direct Pin toggle → label dialog(basename 1~2 grapheme 제안) → confirm → pinned group 맨 뒤로 이동. cancel은 어떤 state도 변경하지 않는다.

### File Explorer · Document List · Tab

- 기존 계약 유지: Explorer는 root 아래 folder와 Markdown file을 이름순으로 섞어 표시하고, Document List는 selected folder의 direct Markdown children만 표시하며, document tab은 root-local one-line title에 tooltip/accessible name으로 canonical 전체 경로를 유지한다.
- AI Document List header action 순서는 pin 상태와 무관하게 `Refresh → Sort → Density → Open Folder`를 유지한다.

## 동작 규칙

- **새 Root 열기:** directory picker → canonicalize → 현재 dirty 문서 저장(save barrier) → target scan → tab 추가·활성화 순서다. canonicalize, save, scan, settings 저장 중 하나라도 실패하면 새 tab을 추가하지 않고 현재 workspace/settings를 유지한다.
- **기존 tab 전환:** 현재 dirty 문서 저장(save barrier)과 target scan이 모두 성공한 뒤 `docsRoot`를 저장하고 root-local session 전체를 복원한다. scan 실패 시 현재 workspace/settings를 유지하고 대상 tab의 runtime availability만 unavailable로 표시한다.
- **Targeted Refresh:** unavailable tab의 canonical root를 직접 scan한다. 현재 workspace save와 target scan이 모두 성공한 뒤에만 해당 root를 활성화하고 기존 session을 복원한다. 실패하면 현재 workspace/settings와 보존 session을 유지한다.
- **Startup recovery:** 저장된 `docsRoot` scan이 실패하면 ordered `docsRoots`의 나머지 entry 중 처음 scan 가능한 root를 `docsRoot`로 저장하고 연다. 가능한 대체 root가 하나도 없으면 저장된 active root의 unavailable placeholder를 열어 `Refresh`와 일반 tab의 `Close` 또는 pinned tab의 `Unpin`을 제공한다. session은 자동 삭제하지 않는다.
- **Root 닫기:** target root를 다시 canonicalize/scan하지 않는다. active 일반 tab을 닫으면 현재 workspace save 후 제거된 index의 오른쪽 entry, 없으면 왼쪽 entry, 둘 다 없으면 `null`을 active로 사용한다. inactive tab close는 active root를 유지한다. 필요한 save와 settings 저장이 실패하면 목록, active root, session을 유지한다.
- **Pin·Unpin·Edit label:** mounted workspace(활성 root)를 바꾸지 않으므로 save barrier가 필요 없다. 목록 순서와 label만 변경하고 session/buffer는 건드리지 않는다.
- **Missing root:** tab과 session을 유지하고 root별 unavailable 표시와 targeted Refresh를 제공한다. inactive missing tab 선택 실패는 현재 active workspace를 교체하지 않는다.
- 동일 물리 파일이 여러 root session에 존재할 수 있지만 활성 root만 runtime buffer를 가지며 전환 save barrier로 직렬화한다.

## 범위 제외

- Human 공간과 Human `FolderTree` 변경
- AI 구조 mutation: create/rename/move/Trash/context menu
- pin drag reorder, label 3 grapheme 이상, label 색상/아이콘
- label 기반 keyboard shortcut 이동
- worktree 간 동일 상대 path 자동 따라가기
- 외부 drag/drop 또는 OS file-association 진입점

## 구현 준비 판정

- **READY.** 전역 mode 제거, pin 의미, versioned migration, session 무손실 병합, unavailable-root 복구, Source Card menu interaction이 확정됐다.
- 구현은 `docs/plans/2026-08-17-ai-unified-pin-tabs-implementation.md`를 Task 단위로 실행하며, Task 1의 source-of-truth 문서 동기화가 product code 변경의 선행조건이다.
- commit/push는 하지 않는다. 사용자가 Git 작업을 소유한다.
