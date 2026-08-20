# AI Explorer File Click Folder Sync

## Goal

AI Explorer에서 file을 click하면 별도 reload 없이 middle Document List가 그 file의 parent folder로 갱신되고, 해당 file이 list에서 선택 표시된 채 화면 안에 보이며, tab으로 열려 있어야 한다. 사용자는 `current-document reload`를 파일마다 눌러 목록을 맞추는 우회 동작을 더 이상 하지 않는다.

## Root Cause

현재 `selectedFolder`를 활성 문서의 parent로 맞추는 코드는 코드베이스 전체에서 한 군데뿐이다.

- `src/components/FileExplorerTree.tsx:158` — file row는 `onOpen(document.path)`만 호출한다. folder row(`:106`)는 `onSelectFolder(entry.path)`를 호출하지만 file row에는 대응 호출이 없다.
- `src/App.tsx:1387` — `onOpenDocument={(path) => void workspace.openDocument(path)}`. folder 동기화가 없다.
- `src/hooks/useLibraryWorkspace.ts:492` — `openDocument`는 disk read 후 `activePath`만 갱신하고 `selectedFolder`는 건드리지 않는다.
- `src/hooks/useLibraryWorkspace.ts:279` — `visibleDocuments`는 `snapshot.documents.filter((document) => document.parent === selectedFolder)`이므로 이전 folder 목록이 그대로 남는다.
- `src/hooks/useLibraryWorkspace.ts:587` — `reloadCurrentDocument()` 안의 `setSelectedFolderState(parentPath(current.path))`가 유일한 동기화 경로다. 유일한 호출자가 `src/App.tsx:1573`의 `current-document-reload` button이라 "reload를 눌러야 동작"하는 증상이 나온다.
- `src/App.tsx:1270` — `selectTab`은 `setActiveDocument`만 호출해 다른 folder의 tab으로 전환해도 list가 갱신되지 않는다.
- `src/hooks/useLibraryWorkspace.ts:524` — active tab을 닫을 때 `closeDocument`가 fallback `activePath`를 직접 설정하므로 fallback이 다른 folder에 있어도 list가 갱신되지 않는다.

증상 세 가지(list 미갱신, 선택 표시 없음, 목록에서 파일이 안 보임)는 문서 활성화 경계가 `selectedFolder`를 함께 갱신하지 않는 데서 파생된다. 파일이 열리는 동작 자체는 정상이다. 특히 이미 active인 file을 다시 여는 경로와 active tab close의 fallback 경로는 `activePath` 변경 여부만으로 조기 반환하거나 직접 변경하므로 별도 회귀가 필요하다.

## Scope

- AI workspace는 `syncFolderToActiveDocument` hook option을 활성화한다. 이때 `openDocument`가 성공하면 새로 읽은 문서와 이미 열린 문서 모두 `selectedFolder`를 그 문서의 parent path로 동기화한다.
- option이 활성화된 `setActiveDocument`는 대상 문서가 존재하면 이미 active인 같은 path여도 folder 동기화를 먼저 수행하고, 실제 tab 전환과 이전 문서 저장만 no-op 처리한다.
- option이 활성화된 상태에서 active tab close가 다른 folder의 fallback tab을 활성화하면 동일하게 동기화한다. fallback이 없으면 기존 folder selection을 유지한다.
- Document List에서 선택된 row가 viewport 밖이면 화면 안으로 스크롤한다.
- `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`의 AI Explorer 계약 문구에 folder 동기화를 반영한다.

## Behavior

1. AI Explorer에서 file을 click하면 `openDocument`가 tab을 열고 `selectedFolder`를 `parentPath(path)`로 맞춘다. 이미 active인 file도 현재 folder selection이 다르면 이를 복구한다. Document List header의 folder 이름과 문서 개수, 목록 rows가 그 folder의 direct Markdown children으로 즉시 갱신된다.
2. 갱신된 목록에서 해당 file row는 `aria-selected="true"`가 되고, Explorer의 parent folder row는 `aria-current="page"`가 된다.
3. 선택된 row가 list viewport 밖이면 `block: "nearest"` 기준으로 스크롤해 보이게 한다. 이미 보이는 경우 스크롤 위치를 바꾸지 않는다.
4. AI에서 다른 folder에 속한 tab으로 전환하거나 active tab close가 다른 folder의 fallback을 활성화하면 같은 규칙으로 `selectedFolder`가 따라간다. 같은 folder 안에서의 전환은 folder state 기준 no-op이다.
5. `openDocument`가 disk read 실패로 `false`를 반환하면 `selectedFolder`와 `activePath`를 모두 바꾸지 않는다.
6. Human(`intent`) mode는 `syncFolderToActiveDocument`를 활성화하지 않는다. Document List 선택, rename, move, Trash, cross-folder tab 전환과 close fallback의 기존 folder-selection 동작을 바꾸지 않는다.
7. AI mode에서 `selectedFolder` 변경은 기존 `onSelectedFolderChange` 경계를 그대로 통과해 `docsRuntime.navigation`에 root별 runtime-only state로 유지된다.

## Boundaries

- Explorer의 `expandedPaths`는 변경하지 않는다. 접힌 folder 안의 file은 click 대상이 아니므로 자동 expand는 필요 없다.
- filesystem 재scan을 유발하지 않는다. 이미 로드된 snapshot에 대한 filter 기준만 바뀐다.
- `syncFolderToActiveDocument`는 optional hook option이며 기본값은 `false`다. `LibraryApp`은 `aiMode`일 때만 `true`를 전달한다.
- option이 활성화된 `setActiveDocument`는 대상 path가 열린 문서인지 먼저 확인한 뒤 folder를 동기화하고, 그 다음 `activePath` 동일성으로 저장/tab 전환을 no-op 처리한다. 존재하지 않는 path는 어떤 상태도 바꾸지 않는다.
- option이 활성화되어도 `closeDocument`의 fallback이 `null`이면 active selection만 비우고 `selectedFolder`는 유지한다.
- `reloadCurrentDocument()`의 기존 `setSelectedFolderState` 호출은 유지한다. 이 경로는 disk 재scan 후의 상태 재정렬 책임을 함께 가지므로 제거하지 않는다.
- list row로 실제 DOM focus를 옮기지 않는다. 시각적 selection과 scroll만 제공해 editor의 입력 focus를 빼앗지 않는다.
- `tabSessions` schema, `settings.json`, native IPC 계약은 변경하지 않는다.
- 새 dependency를 추가하지 않는다.

## Verification

- `syncFolderToActiveDocument: true`에서 nested file을 `openDocument`하면 `selectedFolder`가 parent가 되고 `visibleDocuments`가 그 folder의 direct children만 담아야 한다.
- option 활성 상태에서 active file의 parent와 다른 folder를 선택한 뒤 같은 active file을 다시 `openDocument`하면 disk read나 이전 문서 저장 없이 folder/list가 복구되어야 한다.
- option 활성 상태에서 다른 folder의 tab으로 `setActiveDocument`하면 `selectedFolder`가 따라가고, 같은 folder 안 전환은 상태를 바꾸지 않아야 한다.
- option 활성 상태에서 active tab close의 fallback이 다른 folder면 `selectedFolder`가 따라가고, fallback이 없으면 기존 folder selection을 유지해야 한다.
- read 실패한 `openDocument`는 `selectedFolder`와 `activePath`를 보존해야 한다.
- 기존 `discards a pending reload after the active tab changes` 회귀(`src/hooks/useLibraryWorkspace.test.tsx:187`)가 계속 통과해야 한다. 이 test는 `folder/c.md` → `b.md` 순서로 tab을 옮긴 뒤 `selectedFolder`가 `""`임을 확인하므로 동기화 추가 후에도 성립해야 한다.
- Explorer file click 뒤 Document List header가 해당 folder 이름과 개수를 표시하고, 그 file row가 `aria-selected="true"`여야 한다.
- 선택 row가 viewport 위나 아래로 벗어났을 때만 scroll이 발생해야 한다. 완전히 보이는 row, 빈 list, 선택 없음에는 scroll을 시도하지 않아야 하며, `selectedPath`가 같아도 folder 동기화로 documents가 교체되어 row가 새로 나타나면 가시성을 다시 확인해야 한다.
- option 기본값 `false`와 Human mode에서 Document List 선택, rename/move/Trash, cross-folder tab 전환, close fallback의 folder-selection 동작이 기존과 동일해야 한다.
- 실제 Tauri에서 AI Explorer의 여러 folder를 오가며 file을 연속 click할 때 reload 없이 list, 선택 표시, tab이 한 번에 맞는지 확인한다.

## Non-goals

- Explorer branch 자동 expand
- list row keyboard navigation과 DOM focus 이동
- Human `FolderTree` 동작 변경
- document sort, density, snippet 계산 방식 변경
- file watcher나 background polling 기반 자동 갱신

## Decision Gates

- [x] **App workspace integration test 경로**
  - Impact: 실제 `App → useLibraryWorkspace → Document List` 연결을 검증하는 test ownership과 향후 suite 확장 범위.
  - Current evidence: 기존 `src/App.test.tsx`는 `useLibraryWorkspace`를 전부 mock하고, repository test는 source 파일 옆에 배치한다.
  - Decision: 새 integration test는 `src/App.workspace-integration.test.tsx`에 둔다.
  - Rationale: App 전체 integration suite로 범위를 넓히지 않고 이번 slice의 workspace 연결 책임을 파일명에 명시한다. 이후 Tauri lifecycle이나 settings integration은 별도 책임으로 유지한다.
- [x] **선택 row scroll 판정 semantics**
  - Impact: 이미 보이는 row에서 사용자의 list scroll 위치를 보존하는 user-visible behavior와 test oracle.
  - Current evidence: `.document-list`가 직접 `overflow: auto`를 소유하고, 현재 계약은 viewport 밖의 row만 `block: "nearest"`로 보이게 한다.
  - Decision: list container와 selected row의 `getBoundingClientRect()`를 비교해 row가 위나 아래로 벗어난 경우에만 `scrollIntoView({ block: "nearest" })`를 호출한다.
  - Rationale: fully visible row에서는 scroll 호출 자체를 피하고, above/below/visible 상태를 deterministic component test로 검증한다. 브라우저의 암묵적 no-op 동작에는 계약을 위임하지 않는다.
- [x] **DocumentList component test 경로**
  - Impact: scroll geometry/focus 회귀와 App workspace integration 회귀의 test ownership 분리.
  - Current evidence: repository component test는 source 파일 옆에 배치하고, `DocumentList`에는 아직 전용 test가 없다.
  - Decision: 새 component test는 `src/components/DocumentList.test.tsx`에 둔다.
  - Rationale: geometry stub과 focus 보존은 `DocumentList` 자체 계약으로 고립한다. `src/App.workspace-integration.test.tsx`는 실제 workspace 상태 연결만 검증한다.
- [x] **Folder-active sync 적용 공간**
  - Impact: AI Explorer bug fix가 Human의 cross-folder navigation까지 변경하는지와 shared hook API.
  - Current evidence: canonical contract는 AI Explorer의 file activation을 정의하지만 `useLibraryWorkspace`는 Human과 AI가 공유한다.
  - Decision: optional `syncFolderToActiveDocument` hook option을 기본값 `false`로 추가하고, `LibraryApp`은 `aiMode`일 때만 활성화한다.
  - Rationale: 요청된 AI behavior만 변경하고 Human navigation은 그대로 보존한다. 전역 적용보다 hook option 한 개가 추가되지만 product scope와 회귀 경계가 명확하다.

## Implementation Plan

- [x] **[backend/core] Task 1: workspace folder 동기화 경계**
  - `src/hooks/useLibraryWorkspace.test.tsx`에 `syncFolderToActiveDocument: true` RED를 추가한다: nested `openDocument` 후 `selectedFolder`/`visibleDocuments` 동기화, 다른 folder를 선택한 뒤 같은 active file 재오픈, 다른 folder tab으로의 `setActiveDocument`, active tab close의 cross-folder fallback과 null fallback, read 실패 시 상태 보존.
  - 같은 test file에 option 생략/`false` 회귀를 추가해 cross-folder open/tab/close가 기존 `selectedFolder`를 바꾸지 않음을 고정한다.
  - `src/hooks/useLibraryWorkspace.ts`의 `WorkspaceOptions`에 `syncFolderToActiveDocument?: boolean`을 추가하고 기본값은 `false`로 해석한다. option 활성 시 `setActiveDocument`는 열린 문서 존재 확인 → `setSelectedFolderState(parentPath(path))` → active path 동일성 no-op 순서로 처리한다. `openDocument`의 새 문서 read 성공 경로와 `closeDocument`의 non-null fallback도 같은 조건부 folder 동기화를 적용한다.
  - targeted hook tests, `pnpm check`, `pnpm build`를 통과한다.
  - Evidence: RED에서 AI sync 5건이 `selectedFolder` 불일치로 실패했고, GREEN에서 hook 31 tests와 full Vitest 225 tests가 통과했다. `pnpm check`와 `pnpm build`도 통과했다.

- [x] **[backend/core] 확인 gate**
  - [x] targeted/full test, Biome, TypeScript/Vite build 완료.
  - [x] HTTP/API, native IPC, Rust, generated package 변경 없음.
  - [x] backend/core 변경은 optional hook option과 activation state projection에 한정됨.
  - [x] 사용자 확인 후 frontend/UI phase 시작.

- [x] **[frontend/UI] Task 2: Explorer와 Document List 표면 회귀**
  - 기존 `src/App.test.tsx`는 `useLibraryWorkspace`를 전부 mock하므로 wiring 회귀만 소유한다. AI Explorer file click이 `openDocument(path)`를 호출하는 기존 회귀를 유지하고, mock 상태 변경으로 hook 동기화를 증명하지 않는다.
  - real `useLibraryWorkspace`를 사용하고 native filesystem 경계만 mock하는 `src/App.workspace-integration.test.tsx`를 추가한다. AI Explorer nested file click 뒤 list header가 parent folder와 direct-child count를 표시하고, 해당 row가 `aria-selected="true"`이며 tab이 열린다는 RED를 작성한다. 다른 folder를 선택한 뒤 같은 active file을 재클릭하는 경우도 같은 test surface에서 검증한다.
  - `src/App.tsx`의 `useLibraryWorkspace` options에 `syncFolderToActiveDocument: aiMode`를 전달한다. `src/App.tsx:1387`의 Explorer file-open 배선은 그대로 두고, integration test가 드러낸 실제 App gap만 최소 diff로 보완한다.
  - targeted App unit/integration tests, `pnpm check`, `pnpm build`를 통과한다.
  - Evidence: real hook integration이 Explorer nested file click과 같은 active file 재클릭의 parent list/header/selected row/tab 동기화를 검증한다. targeted 33 tests, Biome, production build가 통과했다.

- [x] **[frontend/UI] Task 3: 선택 row 가시화**
  - 새 `src/components/DocumentList.test.tsx`에 선택 row scroll 회귀를 RED로 추가한다. jsdom의 list/row `getBoundingClientRect`와 `scrollIntoView`를 stub해 fully visible, above viewport, below viewport, selection 없음, 빈 list를 각각 검증한다.
  - `src/components/DocumentList.tsx`는 list container와 selected row를 ref로 추적한다. `selectedPath` 또는 rendered `documents`가 바뀐 뒤 selected row의 `top`/`bottom`을 container rect와 비교하고, viewport 밖일 때만 `scrollIntoView({ block: "nearest" })`를 호출한다.
  - 같은 `selectedPath`가 documents 교체 후 새로 나타나는 회귀와 scroll 뒤 DOM focus가 변하지 않는 회귀를 포함한다.
  - targeted component tests, `pnpm check`, `pnpm build`를 통과한다.
  - Evidence: AI-only opt-in과 visible/above/below/none/empty, documents/snippets/density/resize, focus 회귀 11건 및 App 포함 targeted 91 tests가 통과했다.

- [x] **[frontend/docs] Task 4: canonical contract 동기화**
  - `CLAUDE.md:51`, `DESIGN.md:130`, `docs/specs/intent-memo.md:94`의 AI Explorer 문구에 "file activation은 tab을 열고 그 file의 parent folder를 선택한다"와 선택 row 가시화를 반영한다.
  - `git diff --check`를 통과한다.

- [x] **[slice common] Task 5: 전체 자동·실제 UI 검증**
  - full Vitest, `pnpm check`, TypeScript/Vite build, `cargo fmt`/`clippy`/`test`, `git diff --check`를 통과한다.
  - 실제 Tauri에서 AI Explorer 연속 file click, 다른 folder 선택 후 같은 active file 재클릭, 다른 folder tab 전환과 close fallback, 긴 folder에서의 선택 row 가시성을 확인한다. Human에서는 Document List 일반 선택/rename/move/Trash와 cross-folder tab/close fallback이 기존 folder selection을 유지하는지 확인한다.
  - Evidence: full Vitest 238 tests, Biome 65 files, production build, Rust fmt/clippy/tests, `git diff --check`가 통과했다. 격리 Tauri app에서 restored `alpha-18` row visibility와 root → `beta-07` activation의 folder/header/list/tab/content 동기화를 확인했고 Human/AI AX state 전환도 검증했다. 독립 visual/functional reviewer 2개가 모두 PASS했다.
