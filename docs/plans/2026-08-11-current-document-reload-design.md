# Current Document Reload Icon Design

## Goal

right-click WebView context menu를 거치지 않고 content header의 visible icon으로 현재 활성 Markdown 문서를 다시 불러온다. 사용자는 구현 방식이나 app reload lifecycle을 알 필요 없이 현재 문서 기준 action 하나만 사용한다.

## Scope

- Human과 AI의 활성 문서에 동일한 `RefreshCw` icon action을 제공한다.
- 현재 문서의 disk content만 다시 읽고 pane, tab session, active space, scroll owner는 재초기화하지 않는다.
- document list의 기존 filesystem scan `RefreshCw`와 별도 action으로 유지한다.
- WebView 전체 reload icon, keyboard shortcut, 자동 polling, 새 dependency는 추가하지 않는다.

## Placement

content header의 trailing actions를 다음 순서로 유지한다.

`pane control | tabs | current-document reload | transient save status | mode cycle`

- reload는 활성 문서가 있을 때만 표시한다.
- Human의 mode cycle은 계속 가장 오른쪽 edge cell을 소유한다.
- AI는 mode cycle 없이 reload만 trailing action에 표시한다.
- 기존 `IconButton` anatomy인 30px hit area, Lucide 15px, hover/focus-visible/disabled state를 재사용한다.
- localized tooltip과 accessible name은 `Reload current document` / `현재 문서 다시 불러오기`를 사용한다.

## Behavior

1. clean 또는 saved 문서에서 클릭하면 활성 `{ root, path }`를 disk에서 다시 읽는다.
2. dirty 문서에서는 기존 persist 경계로 save를 먼저 시도한다.
3. save 성공 뒤 disk content를 다시 읽어 body, frontmatter metadata, `mtimeMs`, save status를 갱신한다. 현재 editor mode와 tab identity는 유지한다.
4. saving 중에는 control을 disabled 처리해 중복 save/reload를 만들지 않는다.
5. save conflict, disk read 실패, 삭제된 파일은 기존 error surface에 표시하고 현재 in-memory buffer와 tab을 유지한다.
6. 성공 시 list snapshot을 재스캔해 title, snippet, updated time과 정렬 위치를 현재 disk 상태에 맞춘다.

## Boundaries

- reload는 명시적 사용자 action이며 autosave나 background polling을 추가하지 않는다.
- reload 성공은 tab/session identity를 변경하지 않는다.
- AI의 canonical `{ root, path }` session schema와 Human root-local session schema에 reload state를 저장하지 않는다.
- document-list refresh는 visible folder scan 책임만 유지하고 current-document reload와 합치지 않는다.

## Verification

- 회귀 테스트는 content header에 활성 문서 reload control이 Human/AI 모두 존재하고 active identity를 사용함을 검증한다.
- clean reload는 disk payload로 body/title/mtime을 교체하고 mode·identity를 유지해야 한다.
- dirty reload는 save 성공 후 read하며, conflict/read failure에서는 기존 buffer를 보존해야 한다.
- saving 중 중복 click을 차단하고 문서가 없을 때 control을 렌더하지 않아야 한다.
- 실제 Tauri에서 외부 수정한 현재 Markdown 파일을 icon 한 번으로 다시 불러오고, Human mode와 AI source label/tab이 유지되는지 확인한다.

## Non-goals

- WebView 또는 앱 전체 reload 대체 button
- reload history, undo snapshot, file watcher
- context menu 항목 추가·변경
- Markdown editing toolbar

## Implementation Plan

- [x] **Task 1: workspace current-document reload 경계**
  - `useLibraryWorkspace.test.tsx`에 clean, dirty-save-first, failure-buffer-preservation 회귀를 RED로 추가한다.
  - `useLibraryWorkspace.ts`에 active identity를 유지하며 disk payload와 snapshot/snippet을 갱신하는 `reloadCurrentDocument()`를 추가한다.
  - Targeted hook tests, Biome, build를 통과한다.

- [x] **Task 2: content header reload icon**
  - `App.test.tsx`에 Human/AI visible control, no-document hidden, saving disabled, click delegation을 RED로 추가한다.
  - `i18n.ts`에 localized accessible copy를 추가하고 `App.tsx` trailing actions를 `reload → status → mode` 순서로 배선한다.
  - Targeted App/i18n tests, Biome, build를 통과한다.

- [x] **Task 3: canonical contract 동기화**
  - `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`에 current-document reload의 placement, Human/AI scope, save/conflict 경계를 반영한다.
  - `git diff --check`를 통과한다.

- [x] **Task 4: 전체 자동·실제 UI 검증**
  - full Vitest, Biome, TypeScript/Vite build, Rust fmt/clippy/tests, `git diff --check`를 통과한다.
  - 실제 Tauri에서 Human/AI icon, active document 외부 변경 reload, identity/mode/source-label continuity를 확인하고 독립 시각 검토를 통과한다.
