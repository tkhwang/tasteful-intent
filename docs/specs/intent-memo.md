# Tasteful Intent v0.2 제품 스펙

상태: 구현 기준 확정
작성일: 2026-08-05
제품명: `Tasteful Intent` (`취향 담은 의도`)

## 1. 제품 의도

Tasteful Intent는 나의 생각과 만들고 싶은 것, 원하는 스타일을 기록하고 AI에 전달해 만들어진 결과를 확인하는 가벼운 데스크톱 Markdown 메모 앱이다. Markdown 파일은 사용자가 소유하는 원본이며, 앱은 이 원본을 빠르고 안전하게 작성하고 읽는 데 집중한다.

초기 버전은 AI 기능을 포함하지 않는다. 향후 LLM 기반 개인 지식·비서 기능은 사용자의 원본을 활용하는 파생 계층으로 추가하되, 인간이 작성한 원본을 대체하거나 암묵적으로 변경하지 않는다.

## 2. v0.2 성공 조건

- 기존 `libraryRoot`는 사용자가 직접 의도와 취향을 작성하는 Human 원본 공간으로 유지된다.
- 사용자가 여러 위치의 AI Markdown 파일을 열면 각 문서의 canonical parent path가 자동 표시되고, path 항목 선택으로 연결 문서와 base path를 함께 전환할 수 있다.
- 두 공간의 root와 임의 깊이 하위 폴더에 있는 `.md` 문서를 탐색한다.
- Human 파일과 폴더를 생성·이름 변경·이동하고 시스템 휴지통으로 삭제할 수 있다. AI는 read-only다.
- 문서는 Markdown syntax highlighting이 있는 소스 편집기에서 작성하고 자동 저장된다.
- Human은 같은 문서를 `Edit → View → Split(Edit | View)`로 순환하며, AI는 View로만 읽는다.
- Human root-local tab set과 AI cross-root 전역 tab set으로 여러 문서를 열고 재시작 후 reference와 active tab을 복원할 수 있다.
- Human rename·move·Trash는 문서·폴더 항목의 keyboard-accessible context menu에서 실행한다.
- 외부 변경이나 경계 이탈이 감지되면 원본을 조용히 덮어쓰거나 손상하지 않는다.
- 클린 설치에서는 Human·AI 모두 기본 root를 정하지 않으며, 3단계 onboarding에서 언어·테마·Human 폴더만 정한다. AI는 Open File로 시작한다.

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
- AI용 read-only `{ root, path }` open-document session과 active source projection `docsRoot` (내부 `docs` key 유지)
- `Human Brain ⟶ Bot AI` space switcher와 공간별 목적·기본 mode
- root-level 및 중첩 폴더 Markdown 탐색
- Human 파일·폴더 create, rename, move, system Trash 이동
- 파일명 기반 문서 제목
- UTC ISO 8601 `created`, `updated` frontmatter
- CodeMirror 6 Markdown syntax highlighting
- 자동 저장
- 동일 문서의 rendered View mode
- Human root-local tab과 AI `{ root, path }` 전역 tab session의 재시작 복원
- Human 문서·폴더 context menu 기반 rename, move, system Trash
- 3-pane workspace: 폴더, 문서 목록, content
- pane 단축키: `⌘1` 폴더 pane 토글, `⌘2` 문서 목록과 폴더 pane을 함께 접어 content-only 전환
- Human active root picker와 AI unique source-root `A | B | C` shortcut·문서 활성화
- Human·AI가 공유하는 Full(제목·본문 스니펫 최대 2줄·날짜), Medium(제목·본문 스니펫 1줄), Simple(제목) 밀도의 문서 목록
- Light 기본·Two-Tone·Dark·System 테마 (`charcoal` 내부 key 유지)
- Sans-serif 기본·Serif 글쓰기 typography 선택과 재시작 후 복원
- English 기본·한국어 2열 card 선택 UI와 재시작 후 언어 복원
- 클린 최초 실행 3단계 onboarding과 필수 Human root commit, AI Open File welcome
- Human·AI가 공유하는 최신 순/제목 순 문서 정렬과 외부 변경 재스캔 refresh

### 제외

- 검색, tags, pin
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

클린 settings는 `libraryRoot: null`, `docsRoot: null`, `activeSpace: "intent"`, `theme: "light"`, `language: "en"`, `writingFont: "sans"`, `documentSort: "updated"`, `documentDensity: "full"`로 시작한다. Human root가 없으면 `언어 → 테마 → Human 폴더` 3단계 onboarding을 표시한다. 언어는 English, 테마는 Two-Tone(`charcoal`)을 pre-select하고 즉시 적용·저장하며 skip할 수 있다. Human 폴더는 반드시 사용자가 선택해야 한다.

Human root는 마지막 단계 선택 시 commit한다. AI folder setup은 없으며 AI 공간의 Open File이 absolute Markdown file을 native 경계에서 canonical `{ root: parent, path: filename }`으로 변환한다. 앱은 `Library` 같은 기본 위치나 기본 폴더명을 만들거나 가정하지 않으며 Human root, active space, theme, language, writing font, document sort, shared document density(`documentDensity`, 기본값 `"full"`)와 AI open-document reference는 `settings.json`에 저장하고 재시작 후 복원한다.

### 5.2 Workspace

1. folder pane 상단의 `Human Brain · Bot AI` radio switcher가 두 아이콘을 중앙에 두고 현재 space를 표시·전환한다. 가운데 화살표는 active space에서 target space를 향해 Human 선택 시 `Human → AI`, AI 선택 시 `Human ← AI`로 바뀐다.
2. folder pane은 active space root의 디렉토리 트리를 표시하고, 트리 최상위 이름에는 고정된 `Library` 대신 사용자가 선택한 폴더의 최종 이름을 사용한다.
3. switcher 아래에서 Human/AI는 같은 고정 높이 2단 Source Card를 사용해 전환 시 카드와 folder tree의 세로 위치를 유지한다. Human은 첫 줄 `Tasteful Intent Library`, 둘째 줄 `folder icon | current root path | chevron` picker다. AI는 첫 줄 unique canonical source root의 최초 등장 순서로 하나씩 배정한 30px square `A | B | C` shortcut과 30px `FilePlus2`, 둘째 줄 `active letter | canonical file path | chevron` current-source control이며 active open file에서 값을 자동 파생한다. 같은 root의 여러 문서는 하나의 문자와 shortcut을 공유한다. 펼치면 카드 아래에 open document별 dropdown row가 overlay되고 각 row는 해당 root의 문자, trailing-aligned parent folder, 마지막 parent/file segment가 남는 canonical 전체 file path, active check, close control을 표시한다. Dropdown은 해당 문서를 활성화하고, active-root shortcut은 현재 file을 유지하며 다른 root shortcut은 그 root의 처음 열린 file을 활성화한다. 두 동작 모두 선택한 `{ root, path }`에서 base path와 문서 목록 parent를 함께 파생한다. `FilePlus2`는 Markdown Open File만 실행하고 add/remove folder UI는 없다. Dropdown close 성공 후 menu를 유지하고 active/remaining row로 focus를 복구하며 마지막 문서를 닫으면 AI welcome 상태로 돌아간다.
4. 문서 목록 pane은 선택 폴더의 Markdown 문서를 전역 `documentDensity`에 따라 Full(제목, frontmatter를 제외한 본문 스니펫 최대 2줄, updated 날짜), Medium(제목, 스니펫 1줄), Simple(제목)로 표시한다. 현재 visible 문서만 별도 batch IPC로 읽고 `path + updatedMs`로 cache한다. header action은 Human에서 `Refresh → Sort → Density → Create`, read-only AI에서 `Refresh → Sort → Density → Open File` 순서다. `RefreshCw`는 filesystem을 재스캔하고 하나의 toggle은 최신 순(`updated`, 기본)과 현재 언어의 숫자 인식 제목 순(`title`)을 전환하며, `Rows4`/`Rows3`/`Rows2`는 `Full → Medium → Simple → Full`로 순환한다. 전역 `documentSort`와 `documentDensity`를 Human·AI가 공유한다.
5. content pane 상단은 한 줄만 사용한다. 맨 왼쪽 pane icon 다음에 tab bar를 두고, 우측 actions 맨 앞에는 활성 문서가 있을 때 Human/AI 공통 `RefreshCw`를 둔다. Human tab은 badge 없는 제목 한 줄이고 reload 뒤 가장 오른쪽 mode icon이 `Edit → View → Split(Edit | View)`로 순환한다. AI 전역 tab은 Source Card shortcut과 동일한 compact 문자 badge + `Title`, muted `root basename / relative parent folder` 두 줄이며 filename을 반복하지 않고, read-only라 mode/mutation control을 제공하지 않는다. badge/shortcut은 unique canonical source root의 최초 등장 순서에서 파생하므로 같은 root의 tab은 같은 badge를 공유하고, 한 root의 마지막 문서를 닫을 때만 뒤 root가 함께 재번호화된다. 문자 label은 `{ root, path }` identity나 settings에 저장하지 않는다. tooltip·accessible name에는 문자와 전체 경로를 제공한다.
6. macOS native traffic lights를 유지한 38px overlay titlebar를 사용한다. `Tasteful Intent`는 왼쪽에, 현재 문서 제목은 pane 구성과 무관한 창 중앙에 표시하며 action이나 경로는 추가하지 않는다.
7. Human/AI 전환은 folder pane 상단에서 제공하고, folder pane이 접힌 2-pane에서는 문서 목록 pane 상단에 같은 switcher를 하나만 제공한다. active root 확인·변경은 folder pane 전용으로 유지하며, content pane과 content-only에는 공간·root label을 반복하지 않는다. switcher에는 `⌘1` badge를 표시하지 않고 keyboard `⌘1` 또는 content pane의 pane icon으로 folder pane을 다시 열 수 있다.
8. 첫 tab 바로 앞의 숫자 없는 `PanelLeft` icon control은 `3-pane → folder가 접힌 2-pane → content-only → 3-pane` 순서로 순환한다.

`⌘1`은 폴더 pane만 독립적으로 토글한다. `⌘2`로 문서 목록을 접으면 폴더 pane도 함께 접혀 content-only 상태가 된다. 문서 목록을 다시 펼칠 때 이전 폴더 pane 상태를 복원한다. pane 상태는 앱 재시작 후 복원한다.

Human 문서·폴더의 rename, move, system Trash는 해당 목록 항목의 context menu에서 실행한다. AI 목록은 read-only라 mutation context menu가 없다. Human menu는 mouse 우클릭, Context Menu key, `⇧F10`으로 열 수 있고 dialog 종료 후 원래 항목으로 focus를 복귀한다. 새 의도·새 폴더·문서/폴더 이름 변경 NameDialog는 유효한 single-line 이름에서 Enter와 submit button을 동일하게 처리하되, 공백·제출 중·IME 조합 Enter에는 제출하지 않는다.

### 5.3 문서 편집

- Edit mode는 CodeMirror 6 직접 통합으로 구현하며 syntax tree의 Markdown marker만 공간색으로 강조하고 heading·본문 text는 뉴트럴을 유지한다.
- IME 조합 중에는 autosave나 외부 state 동기화가 조합 입력을 끊지 않는다.
- View mode는 저장 대상과 같은 본문을 Markdown으로 렌더링한다.
- Human에서 새 tab은 Edit로 시작하고 mode icon으로 Edit/View/Split을 순환한다. AI tab은 read-only View다.
- Human tab set은 root-local이다. AI는 모든 open document의 `{ root, path }` 전역 session 하나이며 재시작에는 reference 목록과 active reference만 저장한다. 존재하지 않는 reference만 복원에서 제외한다.
- AI tab/path 선택은 대상 root scan 성공 후 active를 바꾸고 base path와 문서 목록 parent를 대상 reference에서 파생한다. 실패 시 기존 active tab을 유지한다.
- AI dropdown 목록은 open documents의 1:1 projection이고 shortcut 목록은 unique canonical source roots의 projection이다. tab을 닫으면 연결 path가 사라지며 같은 root의 마지막 tab이 닫힐 때만 shortcut도 사라진다. 별도 folder history나 등록 해제 transaction은 없고 디스크 파일은 변경하지 않는다.
- tab 전환은 이전 tab의 background save를 시작하되 막지 않는다. tab 닫기는 해당 tab 저장 성공 후 진행한다.
- 공간 전환과 앱 종료는 모든 pending save와 dirty 문서 저장이 성공한 경우에만 진행한다. 실패하면 현재 공간·tab·buffer를 유지한다.
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

모든 Human native 파일 작업은 `libraryRoot`를 canonicalize하고 대상 경로와 비교한다. AI Open File은 선택한 absolute Markdown file을 canonicalize한 뒤 parent root와 filename으로 분해하고 이후 read는 그 경계를 사용한다.

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

v0.2는 사용자가 편집하는 Human 원본과 여러 위치에서 열어 읽는 AI 결과를 분리한다. 사용자 표시명은 Human/AI이고 내부 key와 `docsRoot` projection은 호환성을 위해 유지한다.

- Human `libraryRoot` (`intent`): 인간이 직접 작성하는 canonical source-of-truth, editable
- AI `{ root, path }` session (`docs`): OS Open File로 연 결과 문서를 read-only로 관리하며, `docsRoot`는 active document source projection이다.

자동 생성·자동 갱신되는 AI 관리 폴더는 후속 범위다. 현재 Docs는 사용자가 연 파일을 읽는 표면이며 root registration을 소유하지 않는다.

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
- Tauri production build 통과
- 실제 앱에서 3단계 Human onboarding, 동일 root의 a.md·b.md와 다른 root의 c.md Open File, same-root tab의 공유 A badge·단일 A shortcut 및 cross-root B 배정, 마지막 same-root tab close 후 shortcut 제거·동시 재번호화, shortcut row `FilePlus2`의 Open File picker, dropdown row close와 연속 close focus, 명확한 keyboard focus, AI read-only/no folder management, Human CRUD/context menu, 다중 tab, pane 단축키, 테마 4종, typography와 언어 재시작 복원을 확인
- 실제 앱에서 Human/AI content header의 current-document reload icon, 외부 수정 반영, Human mode와 AI source label/tab identity 유지를 확인
- 다중 dirty/pending save 상태에서 space 전환·window close가 모든 저장을 기다리고 부분 실패 시 state를 유지하는지 확인
- Light·Two-Tone·Dark·System 각각에서 3-pane/2-pane에는 Human/AI switcher가 정확히 하나 존재하고 active root는 3-pane folder pane에만 표시되는지 확인한다. content-only에는 switcher/root를 노출하지 않으며 tab overflow, empty/error 상태의 가독성과 한글 조판을 확인한다.
