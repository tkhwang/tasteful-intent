# AI Explorer Folder Sync Wire-up

## Goal

AI Explorer(1st pane)에서 file을 활성화하면 content pane 상단의 current-document reload button을 누르지 않아도 middle Document List(2nd pane)가 그 file의 parent folder로 즉시 갱신되게 한다. `docs/plans/2026-08-20-ai-explorer-file-click-folder-sync.md`가 정의한 동작을 실제 App에서 완성한다.

## 증상

- AI mode에서 Explorer의 file을 click해 tab을 열어도 Document List는 이전 folder의 목록을 그대로 보여준다.
- content pane 상단 오른쪽의 current-document reload button(`src/App.tsx:1579`)을 눌러야 목록이 active file의 folder로 맞춰진다.
- PR #45(`762e9d0`)로 수정했다고 알고 있었지만 실제 앱에서는 여전히 재현된다.

## Root Cause

이전 commit이 동작하지 않는 이유는 회귀가 아니라 **미완성 배선**이다. PR #45는 2026-08-20 plan의 Task 1(backend/core)만 담고 있다.

- `src/hooks/useLibraryWorkspace.ts:56` — `syncFolderToActiveDocument` option과 `syncSelectedFolderToDocument`(`:469`)가 추가되었고, `setActiveDocument`(`:494`), `openDocument`(`:524`), `closeDocument`의 fallback(`:557`)이 모두 이 helper를 호출한다. hook 단위 테스트 8건도 함께 merge되었다.
- 그러나 `syncSelectedFolderToDocument`는 `options.syncFolderToActiveDocument`가 truthy일 때만 `setSelectedFolderState(parentPath(path))`를 실행한다(`:471`). option 기본값은 `false`다.
- `src/App.tsx:633-655`의 `useLibraryWorkspace(root, {...})` options에는 `syncFolderToActiveDocument`가 **전달되지 않는다**. `grep syncFolderToActiveDocument src/` 결과 hook과 hook test에만 존재한다. 즉 2026-08-20 plan의 Task 2(App 배선)가 미완료 상태로 남아 helper가 항상 no-op이다.
- 따라서 file 활성화 경로(Explorer file click → `openDocument`, tab 전환 → `setActiveDocument`, active tab close fallback)는 `selectedFolder`를 바꾸지 못하고, 유일한 동기화 경로는 여전히 `reloadCurrentDocument()`(`src/hooks/useLibraryWorkspace.ts:569`) 안의 `setSelectedFolderState(parentPath(current.path))` 한 곳이다. 이것이 "reload를 눌러야 갱신"되는 증상 그대로다.
- 참고: folder row click은 `onSelectFolder={workspace.setSelectedFolder}`(`src/App.tsx:1388`)로 이미 동기 반영된다. 증상은 folder row가 아니라 file 활성화 경계에서 발생한다.

2026-08-20 plan의 Task 3(선택 row 가시화), Task 4(docs 계약 동기화), Task 5(전체 검증)도 미완료다. 이 plan은 남은 Task들을 완성하는 wire-up slice다.

## Scope

- `src/App.tsx`의 `useLibraryWorkspace` options에 `syncFolderToActiveDocument: aiMode`를 전달한다. Human(`intent`) mode는 계속 비활성이다.
- AI root-local session 복원 시 active document가 있으면 `selectedFolder`를 그 문서의 parent folder로 동기화한다.
- real `useLibraryWorkspace`를 사용하는 `src/App.workspace-integration.test.tsx`를 추가해 App → hook → Document List 실제 연결을 회귀로 고정한다.
- `src/components/DocumentList.tsx`에 optional `ensureSelectedVisible` prop을 추가하고 AI에서만 활성화한다. 활성화 시 선택 row가 viewport 밖일 때만 `scrollIntoView({ block: "nearest" })`를 호출하며, 선택/document 목록뿐 아니라 snippet·density·scroll-container 크기처럼 row geometry에 영향을 주는 변화 뒤에도 재판정하고 `src/components/DocumentList.test.tsx`로 고정한다.
- `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`의 AI Explorer 계약 문구에 folder 동기화와 선택 row 가시화를 반영한다.
- 완료 시 `docs/plans/2026-08-20-ai-explorer-file-click-folder-sync.md`의 남은 checkbox를 함께 갱신한다.

## Behavior

2026-08-20 plan의 Behavior 절을 그대로 계승한다. 요약:

1. AI Explorer file click → tab open + `selectedFolder = parentPath(path)` + Document List header/rows 즉시 갱신.
2. 갱신된 목록에서 해당 file row는 `aria-selected="true"`.
3. 선택 row가 list viewport 밖이면 `block: "nearest"`로 스크롤하고, 보이면 스크롤 위치를 유지한다. file activation 직후뿐 아니라 비동기 snippet 반영, density 변경, scroll-container resize 뒤에도 같은 판정을 적용한다.
4. cross-folder tab 전환과 active tab close의 cross-folder fallback도 동일 규칙. 같은 folder 안 전환은 no-op.
5. AI root-local session 복원 시 active document가 있으면 그 문서의 parent folder를 선택하고 Document List를 맞춘다. active document가 없으면 기존 초기 folder selection을 유지한다.
6. `openDocument` 실패 시 `selectedFolder`/`activePath` 보존.
7. Human mode 동작 불변.

## Boundaries

- 기존 `openDocument`/`setActiveDocument`/`closeDocument` 동기화 로직은 수정하지 않는다. `src/hooks/useLibraryWorkspace.ts` 변경은 AI session 복원 완료 시 non-null active document의 parent를 선택하는 경로에 한정한다.
- Explorer `expandedPaths`, filesystem 재scan, `tabSessions` schema, `settings.json`, native IPC 계약은 변경하지 않는다.
- 새 dependency를 추가하지 않는다.
- list row로 DOM focus를 옮기지 않는다.
- row가 완전히 보이면 `scrollIntoView`를 호출하지 않는다. geometry 재판정은 scroll 위치나 focus를 직접 변경하지 않는다.
- 선택 row 자동 가시화는 AI Document List에서만 활성화한다. Human은 `ensureSelectedVisible` 기본값 `false`를 사용해 기존 수동 navigation/scroll behavior를 유지한다.

## Verification

- 신규 integration test: AI Explorer nested file click 뒤 list header가 parent folder 이름과 direct-child 개수를 표시하고, 해당 row가 `aria-selected="true"`이며 tab이 열린다. 다른 folder 선택 후 같은 active file 재클릭 시 folder/list가 복구된다.
- 기존 hook test: `syncFolderToActiveDocument: true`와 nested active session으로 복원하면 `activePath`, `selectedFolder`, `visibleDocuments`가 같은 folder를 가리킨다. option 생략/`false`에서는 기존 initial folder selection을 유지한다.
- 신규 DocumentList component test: fully visible / above / below / 선택 없음 / 빈 list 각각에서 스크롤 호출 여부, documents 교체·비동기 snippet 반영·density 변경·scroll-container resize 후 재판정, focus 불변.
- 기존 hook 회귀(`src/hooks/useLibraryWorkspace.test.tsx`)와 `discards a pending reload after the active tab changes` 유지.
- full Vitest, `pnpm check`, `pnpm build`, `cargo fmt`/`clippy`/`test`, `git diff --check`.
- 실제 Tauri smoke: AI Explorer 여러 folder의 file 연속 click 시 reload 없이 list·선택 표시·tab이 한 번에 맞는지, Human mode folder navigation이 불변인지 확인.

## Non-goals

- Explorer branch 자동 expand, list keyboard navigation, Human `FolderTree` 변경, sort/density/snippet의 계산·표현 방식 변경, file watcher — 모두 2026-08-20 plan과 동일하게 제외. 기존 snippet/density 변화는 visibility 재판정 trigger로만 사용한다.

## Decision Gates

- [x] **AI session 복원 시 folder 동기화**
  - Impact: 재시작 후 복원된 active document와 Explorer/Document List navigation의 일관성.
  - Current evidence: `useLibraryWorkspace` 복원 경로는 `setActivePath(restoredActive)`를 직접 호출하고, root별 folder navigation은 runtime-only라 재시작 시 기본 selection으로 시작한다.
  - Decision: `syncFolderToActiveDocument: true`에서 non-null active session을 복원하면 active document의 parent folder를 선택한다.
  - Rationale: 재시작 직후에도 reload나 재클릭 없이 active document와 middle list가 같은 folder를 가리키게 한다. persistence schema와 native IPC는 변경하지 않는다.
- [x] **선택 row visibility 재판정 lifecycle**
  - Impact: 비동기 content와 pane layout 변화 뒤에도 선택 문서가 실제 viewport 안에 유지되는지.
  - Current evidence: snippets는 initial list render 뒤 비동기로 채워지고 Full/Medium density의 row 높이를 바꾼다. 현재 `.document-list`가 직접 scroll container를 소유한다.
  - Decision: `selectedPath`, rendered `documents`, `snippets`, `density` 변경과 scroll-container resize 뒤 visibility를 재판정한다.
  - Rationale: row가 이미 보이면 scroll을 호출하지 않고, 밖으로 벗어난 경우에만 nearest scroll을 수행한다. browser-native layout/resize 관찰을 사용하며 dependency를 추가하지 않는다.
- [x] **선택 row 자동 가시화 적용 공간**
  - Impact: shared `DocumentList` 변경이 Human의 기존 scroll/navigation behavior까지 바꾸는지.
  - Current evidence: 이 plan의 Goal과 canonical contract는 AI Explorer file activation을 대상으로 하고 Behavior는 Human mode 불변을 요구한다. `DocumentList`는 Human과 AI가 공유한다.
  - Decision: optional `ensureSelectedVisible` prop의 기본값을 `false`로 두고 App은 `aiMode`에서만 활성화한다.
  - Rationale: AI bug fix를 Human behavior로 확장하지 않고 component test에서 enabled/disabled 경계를 직접 고정한다. 기존 `readOnly` prop과 visibility semantics를 결합하지 않는다.

## Implementation Plan

- [x] **[frontend/UI] Task 1: App 배선 + session 복원 sync + workspace integration test** (= 2026-08-20 plan Task 2 보완)
  - `src/hooks/useLibraryWorkspace.test.tsx`를 RED로 보강한다: `syncFolderToActiveDocument: true`와 nested active session 복원 뒤 `activePath`/`selectedFolder`/`visibleDocuments`가 같은 folder를 가리키고, option 생략/`false`는 기존 initial folder selection을 유지한다.
  - `src/hooks/useLibraryWorkspace.ts`의 restore 완료 경로에서 non-null `restoredActive`를 얻은 뒤 기존 sync helper를 통해 parent folder를 선택한다. interactive open/tab/close 경로는 변경하지 않는다.
  - `src/App.workspace-integration.test.tsx`를 RED로 추가한다: real hook + native mock으로 AI Explorer nested file click 뒤 header/`aria-selected`/tab을 검증하고, 다른 folder 선택 후 같은 active file 재클릭 복구를 검증한다.
  - `src/App.tsx:633` options에 `syncFolderToActiveDocument: aiMode` 한 줄을 추가해 GREEN을 만든다.
  - targeted tests, `pnpm check`, `pnpm build`.
  - Evidence: RED에서 restore test는 `selectedFolder`가 `""`로 남고 App integration은 nested list count를 찾지 못해 실패했다. GREEN에서 targeted 33 tests, Biome 64 files, TypeScript/Vite production build가 통과했다.
- [x] **[frontend/UI] Task 2: 선택 row 가시화** (= 2026-08-20 plan Task 3)
  - `src/components/DocumentList.test.tsx` RED: `ensureSelectedVisible: true`에서 `getBoundingClientRect`/`scrollIntoView`/`ResizeObserver` stub으로 visible/above/below/none/empty 판정과 documents 교체·snippet 반영·density 변경·container resize 재판정을 고정한다. prop 생략/`false`에서는 scroll·observer가 동작하지 않는 회귀를 포함한다.
  - `src/components/DocumentList.tsx`: optional `ensureSelectedVisible` prop을 기본 `false`로 추가한다. 활성화 시 container·selected row ref를 추적하고 매 committed render 뒤 layout effect에서 판정해 `selectedPath`, rendered `documents`, `snippets`, `density` 변화를 포괄한다. scroll container resize도 같은 판정 함수로 연결한다.
  - row가 container rect 위/아래로 벗어난 경우에만 `scrollIntoView({ block: "nearest" })`를 호출하고 DOM focus는 변경하지 않는다. observer는 dependency 변경과 unmount 시 정리한다.
  - `src/App.tsx`는 `DocumentList`에 `ensureSelectedVisible={aiMode}`를 전달한다. `readOnly`와 visibility activation은 별도 prop으로 유지한다.
  - targeted tests, `pnpm check`, `pnpm build`.
  - Evidence: RED에서 offscreen/data/resize/focus 7 cases가 scroll 미호출로 실패했다. GREEN에서 DocumentList 11 tests와 App 포함 targeted 91 tests, Biome 65 files, TypeScript/Vite production build가 통과했다.
- [x] **[frontend/docs] Task 3: canonical contract 동기화** (= 2026-08-20 plan Task 4)
  - `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`의 AI Explorer 문구에 "file activation은 tab을 열고 그 file의 parent folder를 선택한다"와 선택 row 가시화를 반영한다.
  - 2026-08-20 plan의 완료된 checkbox를 갱신한다.
  - Evidence: canonical contract 3종에 file/session activation, selected row, async geometry visibility와 focus-preservation을 반영했고 이전 plan의 완료된 frontend/UI·docs checklist를 동기화했다.
- [x] **[slice common] Task 4: 전체 자동·실제 UI 검증** (= 2026-08-20 plan Task 5)
  - full Vitest, `pnpm check`, TypeScript/Vite build, `cargo fmt`/`clippy`/`test`, `git diff --check`.
  - 실제 Tauri에서 Verification 절의 수동 시나리오를 확인한다.
  - Evidence: full Vitest 238 tests, Biome 65 files, TypeScript/Vite production build, Rust fmt/clippy/tests와 diff check가 통과했다. unique bundle identifier와 isolated fixture로 실행한 실제 Tauri에서 restored `alpha-18`이 `alpha / 20 notes` list 안에 보이는 상태, root list에서 `beta-07` click 후 `beta / 7 notes`와 selected row/tab/content가 reload 없이 함께 바뀌는 상태를 확인했다. Human/AI AX 전환과 isolated settings cleanup을 완료했고 independent visual/functional passes 2개가 모두 PASS했다.
