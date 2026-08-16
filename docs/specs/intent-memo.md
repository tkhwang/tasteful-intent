# Tasteful Intent v0.2 제품 스펙

상태: 구현 기준 확정
작성일: 2026-08-05
제품명: `Tasteful Intent` (`취향 담은 의도`)

## 1. 제품 의도

Tasteful Intent는 나의 생각과 만들고 싶은 것, 원하는 스타일을 기록하고 AI에 전달해 만들어진 결과를 확인하는 가벼운 데스크톱 Markdown 메모 앱이다. Markdown 파일은 사용자가 소유하는 원본이며, 앱은 이 원본을 빠르고 안전하게 작성하고 읽는 데 집중한다.

초기 버전은 AI 기능을 포함하지 않는다. 향후 LLM 기반 개인 지식·비서 기능은 사용자의 원본을 활용하는 파생 계층으로 추가하되, 인간이 작성한 원본을 대체하거나 암묵적으로 변경하지 않는다.

## 2. v0.2 성공 조건

- 기존 `libraryRoot`는 사용자가 직접 의도와 취향을 작성하는 Human 원본 공간으로 유지된다.
- AI는 항상 사용자가 선택한 폴더를 열며 독립적인 Browse와 Pinned mode를 제공한다. Browse는 ordered closeable canonical folder tabs와 root별 session을, Pinned는 위치 제한 없이 선택한 여러 labeled canonical 폴더와 root별 session을 복원한다.
- 두 공간의 root와 임의 깊이 하위 폴더에 있는 `.md` 문서를 탐색한다.
- Human 파일과 폴더를 생성·이름 변경·이동하고 시스템 휴지통으로 삭제할 수 있다. AI는 Browse와 Pinned에서 연 문서 본문만 편집할 수 있으며 구조 변경은 허용하지 않는다.
- 문서는 Markdown syntax highlighting이 있는 소스 편집기에서 작성하고 자동 저장되며, `⌘F` 또는 `Ctrl+F`로 현재 문서 본문을 검색할 수 있다.
- Human은 Edit, AI는 View로 새 문서를 열며 두 공간 모두 `Edit → View → Split(Edit | View)`를 순환한다.
- Human, AI Browse, AI Pinned는 각각 root-local tab session을 저장하고 재시작 후 복원할 수 있다.
- Human rename·move·Trash는 문서·폴더 항목의 keyboard-accessible context menu에서 실행한다.
- 외부 변경이나 경계 이탈이 감지되면 원본을 조용히 덮어쓰거나 손상하지 않는다.
- 클린 설치에서는 Human·AI 모두 기본 root를 정하지 않으며 `docsSourceMode`는 `browse`로 시작한다. 3단계 onboarding에서 언어, 테마와 Human/AI 색상, Human 폴더를 정하고 첫 AI 진입에서는 Browse 또는 Pinned를 명시적으로 선택한다.

## 3. 제품 정체성

| 항목 | 값 |
|---|---|
| 표시명 | `Tasteful Intent` |
| 한국어 설명 | `취향 담은 의도` |
| artifact/package/cask slug | `tasteful-intent` |
| bundle identifier | `app.tkbetter.intentmemo` |
| 초기 버전 | `0.1.0` |

기존 PromptPad 이름, 버전, 설정, 데이터 형식은 계승하지 않는다. 기존 사용자나 운영 데이터가 없는 greenfield 제품으로 시작한다.

## 4. v0.2 기능 범위

### 포함

- Human용 기존 read-write `libraryRoot` (내부 `intent` key 유지)
- AI Browse용 ordered canonical `docsBrowseRoots`, active `docsBrowseRoot`, root-local `docsBrowse` sessions와 Pinned용 ordered `{ root, label }` entries, `docsPinnedRoot`, root-local `docsPinned` sessions (내부 `docs` space key 유지)
- `Human Brain ⟶ Bot AI` space switcher와 공간별 목적·기본 mode
- root-level 및 중첩 폴더 Markdown 탐색
- Human 파일·폴더 create, rename, move, system Trash 이동
- 파일명 기반 문서 제목
- UTC ISO 8601 `created`, `updated` frontmatter
- CodeMirror 6 Markdown syntax highlighting
- 자동 저장
- 동일 문서의 rendered View mode
- Human, AI Browse, AI Pinned root-local tab session의 재시작 복원
- Human 문서·폴더 context menu 기반 rename, move, system Trash
- 3-pane workspace: 폴더, 문서 목록, content
- pane 단축키: `⌘1` 폴더 pane 토글, `⌘2` 문서 목록과 폴더 pane을 함께 접어 content-only 전환
- Human active root picker, AI Browse folder tab 추가·전환·닫기, AI Pinned 사용자 label shortcut·문서 활성화
- Human·AI가 공유하는 Full(제목·본문 스니펫 최대 2줄·날짜), Medium(제목·본문 스니펫 1줄), Simple(제목) 밀도의 문서 목록
- Light 기본·Two-Tone·Dark·System 테마 (`charcoal` 내부 key 유지)
- Classic 기본·Terracotta & Teal·Plum & Moss·Mono Duo Human/AI Space Palette와 재시작 후 복원
- Sans-serif 기본·Serif 글쓰기 typography 선택과 재시작 후 복원
- English 기본·한국어 2열 card 선택 UI와 재시작 후 언어 복원
- 클린 최초 실행 3단계 onboarding과 필수 Human root commit, AI 첫 진입 mode 선택과 mode별 folder picker
- root 내부 상대 Markdown 이미지의 View/Split 렌더와 현재 렌더 문서의 system Save as PDF
- Human·AI가 공유하는 최신 순/제목 순 문서 정렬과 외부 변경 재스캔 refresh

### 제외

- workspace 전체 파일명·본문 검색, index, tags, 문서 pin
- Markdown toolbar 및 표·체크박스 편집 보조
- 이미지 붙여넣기와 첨부파일 관리
- template 변수와 block editor
- LLM launcher, chat, embedding, index, graph, backlink, wiki
- repo 연결, file mention, data export
- backend, 동기화, 계정
- font size·custom font 등 추가 appearance 설정 UI
- 기존 PromptPad library·settings migration
- 여러 workspace profile 동시 관리
- 자동 생성·자동 갱신되는 read-only AI 관리 계층
- tab 전환·닫기 및 space 전환 전용 keyboard shortcut

## 5. 정보 구조와 인터랙션

### 5.1 첫 실행

클린 settings는 `libraryRoot: null`, `docsBrowseRoots: []`, `docsBrowseRoot: null`, `docsSourceMode: "browse"`, `docsPinnedRoots: []`, `docsPinnedRoot: null`, `activeSpace: "intent"`, `theme: "light"`, `spacePalette: "classic"`, `language: "en"`, `writingFont: "sans"`, `documentSort: "updated"`, `documentDensity: "full"`로 시작한다. Human root가 없으면 `언어 → 테마 + Human·AI 색상 → Human 폴더` 3단계 onboarding을 표시한다. 언어는 English, 표시상 Step 2는 Two-Tone(`charcoal`)과 Classic(`classic`)을 pre-select하고 두 설정을 독립적으로 즉시 적용·저장하며 skip할 수 있다. Step 2 skip은 Two-Tone과 Classic을 복원한다. Human 폴더는 반드시 사용자가 선택해야 한다.

Human root는 마지막 단계 선택 시 commit한다. AI 첫 진입은 Browse 또는 Pinned를 명시적으로 선택하고 두 mode 모두 directory picker에서 visible non-symlink directory를 canonicalize한다. Pinned는 ancestor/descendant가 겹치는 pin을 거부하고 1~2 Unicode grapheme custom label을 저장한다. 앱은 `Library` 같은 기본 위치나 기본 폴더명을 만들거나 가정하지 않으며 Human root, active space, theme, 전역 Space Palette(`spacePalette`, 기본값 `"classic"`), language, writing font, document sort, shared document density(`documentDensity`, 기본값 `"full"`), AI source mode, Browse root/session, pinned roots/labels와 root-local tab sessions를 `settings.json`에 저장하고 재시작 후 복원한다. 기존 file-first AI session은 문서 파일을 건드리지 않고 복원 상태만 폐기한다.

### 5.2 Workspace

1. folder pane 상단의 `Human Brain · Bot AI` radio switcher가 두 아이콘을 중앙에 두고 현재 space를 표시·전환한다. 가운데 화살표는 active space에서 target space를 향해 Human 선택 시 `Human → AI`, AI 선택 시 `Human ← AI`로 바뀐다.
2. folder pane은 active space root의 디렉토리 트리를 표시하고, 트리 최상위 이름에는 고정된 `Library` 대신 사용자가 선택한 폴더의 최종 이름을 사용한다.
3. switcher 아래의 Source Card는 항상 78px, 39px 두 줄을 유지한다. AI 첫 줄 맨 앞에는 compact `Browse | Pinned`(`일반 | 고정`) selector가 있다. Browse는 Open Folder와 ordered closeable folder tab strip을 사용하며, Pinned는 pin 순서의 1~2 grapheme custom label shortcut과 Pin Folder, active canonical root row를 사용한다. mode, active root, space 전환과 root close 전에 열린 문서를 모두 저장하며 실패하면 기존 mode·root·tab·buffer를 유지한다.
4. Browse 문서 목록 header는 `Refresh → Sort → Density → Open Folder`, Pinned는 `Refresh → Sort → Density`를 표시한다. 두 mode 모두 `.gitignore`와 `.ignore`를 존중하고 hidden/symlink를 제외해 Markdown을 포함한 branch만 scan한다. AI Explorer는 file/folder를 섞어 표시하고 folder click으로 선택과 inline expand/collapse를 함께 수행한다. 가운데 Document List는 선택 folder의 direct Markdown children만 표시한다. missing pinned root는 pin, label, session을 유지하고 localized notice, Refresh, Unpin을 제공한다.
5. Human과 두 AI mode의 tab은 제목 한 줄이다. AI tab은 badge를 사용하지 않되 tooltip과 accessible name에는 canonical 전체 경로를 유지한다. Pinned root row는 `[label] basename`을 표시한다. pin을 해제할 때 열린 tab이 있으면 disk 파일은 유지되고 복원 session만 제거됨을 확인하며, 승인 후 오른쪽 우선·왼쪽 차선 root로 이동한다.
6. 활성 문서에서 `⌘F` 또는 `Ctrl+F`는 content pane 우측 상단의 비모달 현재 문서 검색 overlay를 연다. 대소문자를 구분하지 않는 literal match의 `current/total`을 표시하고 Enter/Shift+Enter 및 다음/이전 button으로 순환한다. Escape와 닫기 button은 overlay를 닫고 이전 focus를 복원한다. Human/AI Edit는 source selection, View는 rendered mark, Split은 두 surface에 같은 active result를 표시한다. 검색은 현재 Markdown body에만 적용하고 workspace scan/index나 persistence를 추가하지 않는다.
7. macOS native traffic lights를 유지한 38px overlay titlebar를 사용한다. `Tasteful Intent`는 왼쪽에, 현재 문서 제목은 pane 구성과 무관한 창 중앙에 표시하며 action이나 경로는 추가하지 않는다.
8. Human/AI 전환은 folder pane 상단에서 제공하고, folder pane이 접힌 2-pane에서는 문서 목록 pane 상단에 같은 switcher를 하나만 제공한다. active root 확인·변경은 folder pane 전용으로 유지하며, content pane과 content-only에는 공간·root label을 반복하지 않는다. switcher에는 `⌘1` badge를 표시하지 않고 keyboard `⌘1` 또는 content pane의 pane icon으로 folder pane을 다시 열 수 있다.
9. 첫 tab 바로 앞의 숫자 없는 `PanelLeft` icon control은 `3-pane → folder가 접힌 2-pane → content-only → 3-pane` 순서로 순환한다.

`⌘1`은 폴더 pane만 독립적으로 토글한다. `⌘2`로 문서 목록을 접으면 폴더 pane도 함께 접혀 content-only 상태가 된다. 문서 목록을 다시 펼칠 때 이전 폴더 pane 상태를 복원한다. pane 상태는 앱 재시작 후 복원한다.

Human 문서·폴더의 rename, move, system Trash는 해당 목록 항목의 context menu에서 실행한다. AI 목록은 구조 변경을 허용하지 않아 mutation context menu가 없다. Human menu는 mouse 우클릭, Context Menu key, `⇧F10`으로 열 수 있고 dialog 종료 후 원래 항목으로 focus를 복귀한다. 새 의도·새 폴더·문서/폴더 이름 변경 NameDialog는 유효한 single-line 이름에서 Enter와 submit button을 동일하게 처리하되, 공백·제출 중·IME 조합 Enter에는 제출하지 않는다.

### 5.3 문서 편집

- Edit mode는 CodeMirror 6 직접 통합으로 구현하며 syntax tree의 Markdown marker만 공간색으로 강조하고 heading·본문 text는 뉴트럴을 유지한다.
- IME 조합 중에는 autosave나 외부 state 동기화가 조합 입력을 끊지 않는다.
- View mode는 저장 대상과 같은 본문을 Markdown으로 렌더링한다.
- View/Split의 상대 이미지 `src`는 현재 문서의 canonical `{ root, path }`를 기준으로 root 내부 regular image만 native read하고 Blob URL로 렌더링한다. hidden path, symlink, root 이탈, 비지원 image MIME은 허용하지 않는다.
- Human에서 새 tab은 Edit, AI 두 source mode에서 새 tab은 View로 시작하고 두 공간 모두 mode icon으로 Edit/View/Split을 순환한다.
- 현재 문서 검색은 source body 발생 순서를 기준으로 하며 Human/AI Edit/View/Split에서 동일 active result를 반영한다. 검색 query와 active result는 저장하지 않는다.
- Human, AI Browse, AI Pinned tab set은 모두 root-local이다. Browse와 Pinned 모두 canonical root별 `paths`와 `activePath` session을 저장한다. Browse는 folder-tab 순서와 active root도 복원한다. 두 AI mode의 session은 독립적이며 mode/root 전환과 root close 전 save barrier를 공유한다. Browse 또는 Pinned root가 일시적으로 없으면 folder tab 또는 pin, label, session을 제거하지 않고 refresh 복구를 허용한다.
- AI root 선택은 대상 root scan 성공 후 active를 바꾸고 root-local tab과 folder navigation을 복원한다. 실패 시 기존 active root와 tab을 유지한다.
- Browse는 label shortcut이나 document dropdown을 만들지 않고 Source Card의 별도 folder tab strip을 사용한다. Pinned menu는 ordered canonical pins의 projection이며 label edit은 root/session identity를 유지하고 Unpin은 해당 root-local session만 제거하며 디스크 파일은 변경하지 않는다.
- tab 전환은 이전 tab의 background save를 시작하되 막지 않는다. tab 닫기는 해당 tab 저장 성공 후 진행한다.
- 공간 전환과 앱 종료는 모든 pending save와 dirty 문서 저장이 성공한 경우에만 진행한다. 실패하면 현재 공간·tab·buffer를 유지한다.
- AI content 저장도 active document의 canonical `{ root, path }`, 같은 디렉토리의 atomic temporary file, open-time mtime conflict 검사를 사용한다. AI 전용 저장 우회 경로는 없다.
- current-document reload는 dirty active document를 먼저 저장한 뒤 동일 `{ root, path }`만 disk에서 다시 읽고 list snapshot을 동기화한다. 성공해도 tab identity, Human mode, AI source label은 유지하며 save/read 실패에는 기존 buffer와 tab을 보존한다. 저장 또는 reload 중에는 중복 reload를 허용하지 않는다.
- 본문은 제품이 정한 고정 최대 폭, 행간, 자간을 사용한다.

## 6. 파일 및 metadata 계약

### 6.1 제목과 경로

- 문서 제목의 canonical source는 확장자를 제외한 파일명이다.
- 제목 변경은 같은 문서의 파일 rename으로 처리한다.
- 빈 제목, 경로 구분자, 예약 이름처럼 유효하지 않은 파일명은 저장 경계에서 거부한다.
- rename이나 move 대상이 이미 존재하면 덮어쓰지 않고 collision 오류를 반환한다.

### 6.2 Canonical Markdown

새 문서는 아래 형식으로 저장한다.

```markdown
---
created: 2026-08-02T03:04:05.000Z
updated: 2026-08-02T03:04:05.000Z
---

# 나의 의도
```

- 두 필드는 UTC `YYYY-MM-DDTHH:mm:ss.sssZ` 문자열이다.
- `created`는 생성 후 변경하지 않는다.
- 본문 저장 또는 파일명 저장이 성공하면 `updated`를 갱신한다.
- `title`, `tags`, `pinned`, `templateValues`, `repoPath`를 v0.1 metadata로 기록하지 않는다.
- 알 수 없는 legacy PromptPad 형식을 변환하는 adapter는 제공하지 않는다.

## 7. 파일시스템 안전 계약

모든 Human native 파일 작업은 `libraryRoot`를 canonicalize하고 대상 경로와 비교한다. AI Browse와 Pinned는 선택 directory를 canonicalize하고 같은 standard ignore rules로 scan하되 hidden path와 symlink를 포함하지 않는다. Markdown 상대 이미지 read도 해당 문서의 root를 canonicalize하고 root containment와 regular-file·지원 MIME을 확인한 뒤 bytes만 반환한다.

- 대상은 항상 요청 root 내부여야 하며 root 자체의 rename·move·delete는 허용하지 않는다.
- 숨김 이름으로 시작하는 파일·폴더와 symlink는 탐색 및 조작 대상에서 제외한다.
- path traversal, symlink traversal, root 외부 absolute path를 거부한다.
- Markdown 문서는 `.md` 확장자만 취급한다.
- 파일 저장은 같은 디렉토리의 임시 파일에 완전한 내용을 기록한 뒤 atomic replace한다.
- 문서 load 시점의 disk modification time을 저장하고, save 시 현재 값과 다르면 `external-change` conflict를 반환한다.
- conflict가 발생하면 디스크 원본을 유지하고 사용자의 편집 내용을 자동으로 버리지 않는다.
- delete는 운영체제 시스템 휴지통으로 이동한다. 영구 삭제 API는 제공하지 않는다.
- 휴지통 이동이 실패하면 원본을 유지하고 오류를 표시한다.

## 8. 오류 표면

사용자가 해결할 수 있는 실패는 content pane 또는 해당 조작 근처에 간결하게 표시한다.

- 외부 변경 충돌
- 같은 이름의 파일·폴더 충돌
- library 경계 이탈 또는 허용되지 않은 경로
- 읽기·쓰기·rename·move·trash 실패

오류를 표시한 뒤 선택 문서와 편집 buffer를 유지한다. 실패를 성공처럼 처리하거나 silent overwrite하지 않는다.

## 9. 장기 확장 경계

v0.2는 사용자가 편집하는 Human 원본과 Browse 또는 Pinned로 관리하는 AI 결과를 분리한다. 사용자 표시명은 Human/AI이고 내부 space key `intent`/`docs`는 유지한다.

- Human `libraryRoot` (`intent`): 인간이 직접 작성하는 canonical source-of-truth, editable
- AI Browse (`docs`): OS Open Folder로 추가한 ordered canonical `docsBrowseRoots`, active `docsBrowseRoot`, root별 `docsBrowse` tab session이다.
- AI Pinned (`docs`): arbitrary canonical `{ root, label }` entries와 active `docsPinnedRoot`, root별 `docsPinned` tab session이며 selected/expanded navigation은 runtime-only다.

자동 생성·자동 갱신되는 AI 관리 폴더는 후속 범위다. 현재 AI는 사용자가 선택한 폴더를 탐색하고 그 안의 Markdown 본문을 읽고 편집하는 표면이다.

## 10. 배포 계약

- macOS Tauri app은 기존 signing·notarization workflow를 단일 앱 경로에 맞게 유지한다.
- macOS app과 release artifact basename은 `TastefulIntent`, repo/package/Homebrew cask token은 `tasteful-intent`, 사용자-facing 브랜드는 `Tasteful Intent`를 사용한다.
- v0.1 업데이트는 Homebrew가 관리하므로 cask는 `auto_updates`를 선언하지 않는다. 사용자 library와 앱 데이터 보존을 위해 `zap` stanza를 정의하지 않는다. In-app updater는 후속 범위다.
- `release: published` 이후 tap update workflow가 실행되도록 구성한다.
- 원격 tap 수정, repository secret 등록, 실제 release 발행은 자격증명이 필요한 배포 작업으로 로컬 구현과 분리한다.

## 11. 검증 기준

- TypeScript build 및 non-mutating Biome check 통과
- frontend와 filesystem 경계 회귀 테스트 통과
- Rust format, clippy, tests 통과
- 실제 Tauri 창에서 `⌘F`·`Ctrl+F`, 결과 count, Enter/Shift+Enter 순환, Edit/View 표시, Escape 닫기를 확인
- Tauri production build 통과
- 실제 앱에서 3단계 Human onboarding의 표시상 Step 2에 Theme과 Space Palette를 모두 제공하고 작은 창에서도 상단부터 navigation까지 스크롤 가능한지 확인한다. AI 첫 mode 선택, folder-only picker, Browse folder tab 추가·전환·닫기·재시작 복원, duplicate custom Pinned labels와 label edit, `[label] basename` Explorer, inline folder expansion, direct-child Document List, 명확한 keyboard focus, AI content edit와 구조 변경 제한, Human CRUD/context menu, 다중 document tab, pane 단축키, 테마 4종, Space Palette 4종, typography와 언어 재시작 복원을 확인한다.
- 실제 앱에서 AI View의 `Eye` mode control이 Split의 `Columns2`, Edit의 `PencilLine`, 다시 View로 순환하고 AI Edit 변경이 active `{ root, path }`에 저장되는지 확인한다.
- 실제 앱에서 Human/AI content header의 current-document reload icon, 외부 수정 반영, Human mode와 AI source label/tab identity 유지를 확인
- 실제 앱에서 root 내부 상대 Markdown 이미지가 렌더되고 Human/AI 및 Edit/View에서 PDF export가 system print dialog를 열며 저장한 PDF가 앱 chrome 없이 같은 이미지와 본문을 포함하는지 확인한다.
- 다중 dirty/pending save 상태에서 space 전환·window close가 모든 저장을 기다리고 부분 실패 시 state를 유지하는지 확인
- Light·Two-Tone·Dark·System 각각에서 3-pane/2-pane에는 Human/AI switcher가 정확히 하나 존재하고 active root는 3-pane folder pane에만 표시되는지 확인한다. content-only에는 switcher/root를 노출하지 않으며 tab overflow, empty/error 상태의 가독성과 한글 조판을 확인한다.
