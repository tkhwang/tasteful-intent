# AI Folder Modes 설계

**Goal:** AI 문서 viewer는 항상 사용자가 선택한 폴더를 탐색 root로 열고 그 안의 Markdown 문서를 본다. AI 전체에는 `일반 | 고정` 두 전역 mode가 있으며, 일반은 닫을 수 있는 여러 folder tab을, 고정은 사용자 label을 가진 여러 pinned folder를 관리한다.

**Why:** 파일 picker와 폴더 picker를 섞으면 AI 문서의 source boundary가 불명확해진다. AI viewer의 원칙을 folder-first로 통일하고, 두 mode의 차이를 입력 종류가 아니라 **닫을 수 있는 열린 folder session**과 **직접 해제할 때까지 유지되는 pinned folder**의 lifecycle로 제한한다.

## 확정 결정

1. **Folder-first.** 일반과 고정 모두 directory picker로 시작하며 개별 Markdown 파일 picker로 AI workspace를 만들지 않는다.
2. **전역 mode.** `일반 | 고정`은 개별 폴더 상태가 아니라 AI workspace 전체의 탐색 정책이다. 한 시점에는 한 mode만 mount한다.
3. **일반 mode.** 사용자가 여는 canonical folder마다 닫을 수 있는 folder tab을 추가한다. 새 폴더를 열어도 기존 일반 root/session을 교체하지 않으며 exact root가 이미 열려 있으면 그 tab을 활성화한다.
4. **일반 session 복원.** 닫지 않은 folder tab 순서, active folder tab, 각 folder의 열린 document tab·active document를 settings에 저장하고 재시작 후 복원한다. folder tab을 닫으면 해당 일반 root/session을 제거한다.
5. **고정 mode.** 여러 canonical folder를 pin 순서대로 유지하며 각 root는 독립 tab session을 가진다.
6. **Custom label.** 자동 `A/B/C` 대신 pin할 때 사용자가 비어 있지 않은 최대 2개의 Unicode grapheme cluster label을 지정한다.
7. **Label 제안.** folder basename의 앞 1~2 grapheme를 editable 기본값으로 채우고 사용자가 확인·수정 후 제출한다.
8. **Label 중복 허용.** label은 표시용 별칭이고 identity는 canonical root다. 동일 label은 folder basename과 전체 경로로 구분한다.
9. **Label 수정.** pinned root menu에서 label만 수정하며 root, pin 순서, active root, tab session은 유지한다.
10. **Label 안정성.** unpin해도 다른 label을 재번호화하거나 변경하지 않는다.
11. **임의 위치 허용.** git worktree는 주요 사례일 뿐이며 사용자가 선택한 visible non-symlink canonical folder라면 위치와 repository 여부를 제한하지 않는다.
12. **중첩 pin 금지.** 기존 pin과 exact match면 활성화하고 조상·자손 관계면 추가하지 않는다.
13. **Missing root 유지.** 사라진 root의 pin, label, paths, activePath를 유지하고 같은 canonical path가 복구되면 session을 복원한다.
14. **Legacy reset.** 기존 파일 기반 `docsRoot`/`tabSessions.docs`는 folder session으로 자동 승격하지 않는다. 사용자 파일은 건드리지 않고 legacy tab 복원 상태만 폐기한다.
15. **3-pane 유지.** AI도 `Explorer | Document List | Content` 구조를 사용한다.
16. **Explorer.** left pane은 file/folder를 함께 보여주는 collapsible tree다. folder row는 선택과 inline expand/collapse를 수행하고 file row는 Markdown 문서를 연다.
17. **고정 root row.** 선택 label과 basename을 `[A] folder`, `[T1] folder`처럼 표시한다. 일반 mode root row는 label 없이 basename만 표시한다.
18. **Document List.** Explorer에서 선택한 folder의 직접 포함 Markdown 파일만 한 단계 표시한다. descendant를 재귀적으로 합치지 않는다.
19. **제품 용어.** 한국어 selector는 `일반 | 고정`, English selector는 `Browse | Pinned`다.
20. **컴포넌트 경계.** AI combined explorer는 `src/components/FileExplorerTree.tsx`와 `FileExplorerTree.test.tsx`가 소유한다. 기존 `FolderTree.tsx`는 Human folder-only navigation으로 유지한다.

## 데이터 모델 · 영속화

- `docsSourceMode`: `"browse" | "pinned"`. default는 `browse`이며 마지막 전역 mode를 복원한다.
- `docsBrowseRoots: string[]`: 일반 mode에서 열린 canonical root의 tab 순서다.
- `docsBrowseRoot: string | null`: 활성 일반 folder tab이며 `docsBrowseRoots`에 속해야 한다.
- `tabSessions.docsBrowse[root]`: 일반 root별 `{ paths, activePath }` document session이다.
- exact root 재선택은 중복 추가가 아니라 기존 folder tab 활성화다.
- 현재 단일 `docsRoot`/`tabSessions.docs` folder-first 상태는 다중 일반 model 적용 시 한 개의 일반 folder tab/session으로 승격한다.
- `docsPinnedRoots: { root: string; label: string }[]`: pin 순서와 custom label을 함께 저장한다. canonical root가 identity다.
- `docsPinnedRoot: string | null`: 활성 pinned root다.
- `tabSessions.docsPinned[root]`: 고정 root별 `{ paths, activePath }` session이다.
- Pinned Explorer의 selected/expanded state는 앱 실행 중 root별 runtime map으로만 유지한다.
- 기존 `open-files` 또는 legacy `{ documents, active }` session은 `browse`로 fallback하되 `docsRoot: null`, 빈 일반 tab session으로 시작한다.
- 기존 `pinned-folders` 값은 `pinned`로 읽고 유효한 pinned root/session은 보존한다.
- label은 trim 후 `Intl.Segmenter` 기준 1~2 grapheme로 검사한다. 중복 비교는 하지 않는다.

## Native boundary · scan

- directory picker 결과는 settings에 직접 저장하지 않고 native canonical-root validation을 통과시킨다.
- 일반과 고정 모두 동일한 AI read-only scan command를 사용한다.
- scan은 `.gitignore`/`.ignore`, hidden entry, symlink 제외를 적용하고 visible Markdown 및 그 ancestor folder만 반환한다.
- Human `scan_library`와 mutation 동작은 변경하지 않는다.
- scan 실패는 빈 snapshot으로 session을 덮어쓰지 않는다.

## UI 계약

### 첫 AI 진입

- `일반 | 고정` 두 mode를 명시적으로 선택할 수 있게 표시한다.
- 일반 선택 시 `AI 폴더 열기`, 고정 선택 시 `AI 폴더 고정` action을 제공한다.
- 두 action 모두 directory picker를 연다.

### Source Card

- 일반 mode는 현재 열린 folder를 닫을 수 있는 folder tab strip으로 표시하고 `AI 폴더 열기`로 tab을 추가한다.
- 일반 folder tab strip은 Source Card의 mode selector 아래에 두며 Content 상단의 document tab strip과 합치지 않는다.
- folder tab은 basename을 주 label로 표시하고 기존 `formatRootDisplay` 규칙의 compact parent와 전체-path tooltip/accessibility data로 같은 basename을 구분한다.
- 활성 folder tab을 바꾸면 해당 root의 Explorer, Document List, 열린 document tab과 active document를 함께 복원한다.
- 일반 folder tab을 닫으면 그 root의 문서 session도 제거한다. 다른 일반 folder tab과 pinned root/session에는 영향을 주지 않는다.
- 재시작 시 일반 root가 사라졌어도 tab/session을 자동 삭제하지 않는다. unavailable 상태를 유지하고 사용자가 tab을 닫거나 동일 canonical path를 복구하도록 한다.
- 고정 mode는 기존 custom-label shortcut과 root menu를 유지하며, 사용자가 직접 고정 해제하기 전까지 root/session을 보존한다.

- 일반: 첫 줄의 `[Browse selector] | Open Folder action`과 둘째 줄의 ordered closeable folder tab strip. label shortcut group은 없다.
- 고정: `[Pinned selector] | label | label | … | Pin Folder action`과 활성 `[label] canonical root` row.
- mode/root 전환과 root close는 dirty-document save barrier 성공 후에만 settings와 mounted workspace를 변경한다.
- label이 중복되어도 각 control의 tooltip/accessible name은 folder basename과 canonical full path를 포함한다.

### File Explorer

- root row 아래 folder와 Markdown file을 이름순으로 섞어 표시한다.
- folder row click은 해당 folder를 selected folder로 만들고 branch를 toggle한다.
- file row click은 문서를 tab에 열고 active tab으로 만든다.
- 고정 mode root row는 `[label] basename`, 일반 mode root row는 `basename`이다.
- hidden/ignored/symlink entry와 Markdown이 없는 branch는 표시하지 않는다.

### Document List · Tab

- 가운데 목록은 selected folder의 direct Markdown children만 기존 sort/density/snippet anatomy로 표시한다.
- 두 AI mode 모두 root-local session이므로 tab은 Human과 같은 one-line title을 사용한다.
- canonical 전체 경로는 tooltip과 accessible name에 유지한다.

### Label dialog · menu

- pin: folder 선택 → canonical validation → label dialog → confirm → pin/activate 순서다.
- label dialog는 basename의 앞 1~2 grapheme를 제안하고 1~2 grapheme만 제출 가능하다.
- cancel은 root/settings/runtime state를 변경하지 않는다.
- pinned root menu는 `Edit label`과 `Unpin`을 제공한다.
- Edit label은 동일 validation을 사용하고 label만 변경한다.

## 동작 규칙

- **Mode 전환:** 현재 dirty 문서 저장 → mode 저장 → 대상 독립 session을 disk에서 복원한다. 실패하면 현재 mode/buffer/settings를 유지한다.
- **일반 root 추가·전환·닫기:** dirty 저장 → 새 root canonicalize/scan → tab 추가 또는 exact tab 활성화. 전환은 root-local session 전체를 복원하고 닫기는 해당 root/session만 제거한다.
- **Pin:** exact canonical match는 기존 pin을 활성화하고 새 label dialog를 열지 않는다. ancestor/descendant overlap은 localized error로 중단한다.
- **Pinned root 전환:** dirty 저장 후 root-local tab session과 Explorer runtime state를 복원한다.
- **Unpin:** 열린 tab이 있으면 session 제거 안내를 확인한다. 승인 후 해당 root/label/session만 제거하고 다른 label은 유지한다.
- **Missing root:** label과 session을 유지하고 refresh/unpin을 제공한다. 복구 refresh 후 실제로 없는 path만 제거한다.
- 동일 물리 파일이 두 mode session에 존재할 수 있지만 활성 mode만 runtime buffer를 가지며 전환 save barrier로 직렬화한다.

## 범위 제외

- Human 공간과 Human `FolderTree` 변경
- AI 구조 mutation: create/rename/move/Trash/context menu
- pin drag reorder, label 3자 이상, label 색상/아이콘
- worktree 간 동일 상대 path 자동 따라가기
- 외부 drag/drop 또는 OS file-association 진입점

## 구현 준비 판정

- **READY.** 사용자 결정이 필요한 folder/source/session/label/explorer 계약은 모두 확정됐다.
- 구현은 `docs/plans/2026-08-16-ai-source-modes-implementation.md`의 Folder-first revision Task를 순서대로 실행한다.
- commit/push는 하지 않는다.
