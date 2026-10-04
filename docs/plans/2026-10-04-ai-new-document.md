# AI New Document

## Goal

AI section은 지금까지 AI가 만든 Markdown을 읽고 본문만 편집하는 표면이었다. 그런데 AI root 안에 requirement 같은 문서를 사람이 직접 새로 써야 하는 경우가 생겼다. AI 문서 목록 header에서 새 Markdown 문서를 만들고 바로 작성할 수 있게 한다.

## 현재 상태

- AI 문서 목록 header의 마지막 `+` button은 `AI 폴더 열기`로 동작한다(`src/App.tsx`).
- 같은 동작이 AI Source Card의 `FolderPlus` button과 빈 content 상태에도 이미 있다. list pane이 보이면 Source Card도 항상 보이므로 header `+`는 중복 진입점이다.
- native `create_document`는 root를 인자로 받아 canonical root 안에서만 생성하므로 AI root에서도 그대로 쓸 수 있다. AI 본문 저장도 이미 같은 `save_document`/frontmatter 경로를 쓴다.

## Behavior

1. AI 문서 목록 header 순서를 Human과 같은 `Refresh → Sort → Density → Create`로 맞춘다. AI Create의 accessible name은 `New document` / `새 문서`다.
2. Create는 공유 NameDialog(`새 문서`, field `파일명이 될 제목`)를 열고, 제출하면 현재 선택 folder에 `<title>.md`를 만든다.
3. 새 문서는 AI 기본 mode(View)가 아니라 Edit mode tab으로 열린다. 새 문서는 쓰기 위해 만드는 것이므로 Human/AI 공통으로 Edit로 연다.
4. 생성 후 AI scanner(`scan_docs_root`)로 다시 scan하므로 Explorer와 Document List에 바로 나타난다.
5. active AI root가 unavailable이면 Create를 비활성화한다.
6. AI 폴더 열기는 Source Card의 `FolderPlus`와 빈 content 상태 button이 계속 담당한다.
7. AI folder 생성, rename, move, Trash는 계속 제공하지 않는다. AI Document List에는 mutation context menu가 없다.

## Scope

- `src/App.tsx`: list header 마지막 button을 space와 무관하게 `setDialog("document")`로 바꾸고 AI unavailable root에서 비활성화한다.
- `src/hooks/useLibraryWorkspace.ts`: `addDocument`가 새 문서를 `defaultMode` 대신 Edit로 연다.
- Tests: hook에서 AI scanner·선택 folder·Edit mode를, App에서 AI `새 문서` 진입·dialog 제출·folder 생성 부재·unavailable 비활성화를 고정한다.
- Docs: `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`, `README.md`, `README.ko.md`의 AI 구조 변경 제한 문구를 갱신한다.

## Verification

- `pnpm test`
- `pnpm check`
- `pnpm build`
- `pnpm tauri:dev`에서 AI root의 하위 folder를 선택하고 `새 문서`로 만든 파일이 Edit로 열리고 저장되는지 확인한다.
