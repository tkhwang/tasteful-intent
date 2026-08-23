# Tasteful Intent Design System

## 0. Research Log

- 제품 기준: `docs/specs/intent-memo.md`의 인간 원본 중심 Markdown editor 계약.
- UX 기준: `.scratch/pivot-markdown-editor/research/miaoyan-ux.md`에서 MiaoYan의 세 pane, 제목+날짜 문서 셀, content 중심 접기 규칙, 고정 본문 폭과 CJK 조판을 추출했다. 브랜드 자산이나 화면을 복제하지 않는다.
- 스타일 기준: frontend `minimalist-skill`의 premium utilitarian minimalism을 적용하되, 메모 앱의 읽기 집중을 위해 장식적 hero·gradient·glass는 사용하지 않는다.
- 성능·접근성 기준: frontend `perfection`의 semantic HTML, keyboard, focus, reduced-motion, real-browser 검증 규칙을 적용한다.
- 추가 React dev tooling은 repo 규칙의 "명시 요청 없는 dependency 추가 금지" 때문에 설치하지 않는다. 제품에 필요한 CodeMirror와 테스트 도구만 사용한다.
- 이미지 concept draft와 lazyweb 조사는 실행하지 않는다. 이 앱은 기존 MiaoYan 소스 조사와 확정된 3-pane 제품 계약이 구체적 reference packet을 제공한다.

## 1. Atmosphere & Identity

Tasteful Intent는 조용한 종이 책상처럼 느껴져야 한다. 크롬은 낮은 대비의 따뜻한 회색 표면으로 물러나고, 사용자가 쓴 Markdown과 현재 선택 상태만 선명하게 남는다.

기억에 남아야 할 순간은 `Brain Human ⟶ Bot AI`가 인간의 의도에서 AI 결과로 이어지는 흐름을 명확히 보여주고, `⌘2`로 양쪽 pane이 사라져 글만 남는 전환이다. 장식 애니메이션 대신 목적과 content 집중의 상태 변화가 제품의 signature interaction이다.

### App Icon

- App icon의 symbol·flow·size 계약은 Components의 `AppIcon` 절을 단일 canonical rule로 사용한다.

## 2. Color

### Palette

색상은 CSS custom properties로만 소비한다.

| Token | 역할 |
|---|---|
| `--canvas` / `--panel` / `--list` / `--content` | 라이트 그레이 canvas·list와 흰 editor surface |
| `--sidebar-bg` / `--sidebar-text` / `--sidebar-muted` / `--sidebar-border` | sidebar 전용 surface·text·separator; Two-Tone에서 sidebar만 `#272C34` |
| `--text` / `--muted` / `--border` | 뉴트럴 본문·보조 text·pane separator |
| `--space-accent` | Human muted red / AI slate blue 강조선·caret·marker |
| `--space-tint` | 선택된 switcher·folder·document·mode의 옅은 공간색 surface |
| `--space-text` | active label·root leaf·link의 대비 text |
| `--human-*` / `--ai-*` | Space Palette가 제공하는 Human/AI raw accent·tint·text와 dark 변형 |
| `--selection` / `--selection-text` | dialog 등 공간과 무관한 선택 상태 |
| `--danger` | destructive action |
| `--diff-added-bg` / `--diff-added-text-bg` / `--diff-removed-bg` / `--diff-removed-text-bg` | AI View diff toggle의 추가·삭제 라인 background와 강조 text-level background |

### Rules

- `data-theme`은 Light(기본), Two-Tone, Dark를 표현하고 System은 runtime에서 OS light/dark로 해석한다. Two-Tone의 내부 `data-theme`·저장 key는 호환을 위해 `charcoal`을 유지한다.
- `data-space-palette`는 `classic`, `terracotta-teal`, `plum-moss`, `mono-duo` 중 하나이며 Human/AI raw token 쌍만 바꾼다. Theme과 독립적으로 저장하고 dark 변형 선택은 오직 resolved `data-theme`이 담당한다.
- Light는 라이트 그레이 3-pane, Two-Tone은 sidebar만 블루 잉크 `#272C34`, Dark는 전체 블루-차콜 surface를 사용한다.
- 색상만으로 선택·오류를 표현하지 않고 shape, label, icon을 함께 사용한다.
- 본문 surface에는 gradient, glass, noise를 사용하지 않는다.
- 한 화면의 강조색은 active mode와 focus indication에만 제한한다.

## 3. Typography

### Scale

| Token | 크기/행간 | 용도 |
|---|---|---|
| `--type-xs` | 11px / 1.35 | 날짜·shortcut hint |
| `--type-sm` | 13px / 1.45 | pane labels·controls |
| `--type-body` | 16px / 1.74 | editor·rendered body |
| `--type-title` | 22px / 1.3 | 문서 제목 |
| `--type-empty` | 34px / 1.2 | 빈 상태 문구 |

### Font Stack

- UI control과 application chrome은 앱에 포함된 `IBM Plex Sans KR`를 사용하며 system sans를 fallback으로 둔다.
- 왼쪽 pane의 folder/file tree는 경로 계층과 이름 정렬을 빠르게 비교할 수 있도록 `--fixed-font` 고정폭 stack을 사용한다.
- 글쓰기 surface는 `--writing-font`로 분리한다. Sans-serif 기본값은 앱에 포함된 `IBM Plex Sans KR`, Serif는 앱에 포함된 `Hahmlet`이며 기존 macOS system font stack은 fallback으로 유지한다.
- 선택한 writing font는 Markdown editor·rendered view·큰 빈 화면 문구에만 적용한다. inline code와 code block은 `SFMono-Regular`, `Cascadia Code`, monospace를 유지한다.
- 한글과 Latin WOFF2의 400·500·600·700 weight만 번들한다. 전체 Fontsource CSS와 `IBM Plex Mono`는 포함하지 않아 packaged asset 수와 혼합 한글 fallback을 제한한다.
- bundled family에 별도 italic face가 없으므로 Markdown emphasis를 위해 style 합성만 허용하고 weight 합성은 사용하지 않는다.

### Rules

- 본문은 `word-break: keep-all`을 우선하고 긴 URL·code에서만 overflow wrapping을 허용한다.
- 한글 조사 한 글자가 고립될 정도로 content column을 좁히지 않는다.
- 제목은 한 줄 ellipsis, 문서 본문은 잘라내지 않는다.

## 4. Spacing & Layout

### Base Unit

기본 단위는 4px이다. 제품 화면에서 사용하는 간격은 4, 8, 12, 16, 20, 24, 32px로 제한한다.

### Grid

- macOS window는 38px overlay titlebar와 나머지 app content의 2-row shell이다. titlebar 왼쪽에는 `Tasteful Intent`, 창의 절대 중앙에는 현재 문서 제목을 한 줄 ellipsis로 표시한다.
- Desktop 기본: folder 216px, document list 280px, content는 나머지.
- 각 pane은 독립 scroll owner이며 flex child에 `min-inline-size: 0`, `min-block-size: 0`을 적용한다.
- rendered body의 읽기 폭은 최대 880px, editor source 폭은 최대 960px다.
- 900px 미만에서는 folder pane을 기본 접고, 700px 미만에서는 list pane도 접을 수 있다. Tauri 최소 창 폭에서는 horizontal page scroll이 생기지 않는다.

### Rules

- pane separator는 1px border만 사용한다.
- 문서 list row는 전역 밀도 설정에 따라 Full(제목 1줄, 본문 스니펫 최대 2줄, updated 날짜), Medium(제목 1줄, 본문 스니펫 1줄), Simple(제목 1줄) 높이를 사용한다.
- content 하단에는 최소 96px의 읽기 여백을 둔다.

## 5. Components

### WindowTitleBar

- native traffic lights는 유지하고 Tauri overlay titlebar의 drag region 위에 제품명과 현재 문서 제목만 표시한다.
- 제품명 `Tasteful Intent`는 traffic lights 다음 왼쪽에 고정하고, 현재 문서 제목은 pane 폭과 무관한 창의 절대 중앙에 둔다.
- 문서가 없으면 중앙 제목은 비워 두며 별도 breadcrumb·path·action을 추가하지 않는다.
- 높이는 38px, 하단은 `--border` 1px separator, text는 `--type-xs`와 한 줄 ellipsis를 사용한다.

### AppShell

- 상태: onboarding, loading, ready, fatal error.
- `libraryRoot`가 없는 onboarding은 `언어 → 테마 + Human·AI 색상 → Human 폴더` 3단계다. 언어 English, 테마 Two-Tone, Space Palette Classic을 pre-select하고 즉시 적용하며 앞의 두 표시 단계는 skip할 수 있다. 표시상 Step 2에서 Theme과 Space Palette를 모두 제공하고, skip은 Two-Tone과 Classic을 복원한다. Human 폴더는 필수다.
- AI에는 onboarding folder setup 단계가 없다. 첫 AI 진입에서는 단일 `AI 폴더 열기` action으로 folder picker를 연다.
- ready 상태만 `FolderPane`, `DocumentList`, `ContentPane`을 렌더링한다.

### PaneHeader

- label, 현재 경로 또는 mode, 필요한 icon button 최대 4개.
- document list header action은 Human에서 `Refresh → Sort → Density → Create`, AI에서 pin 여부와 무관하게 `Refresh → Sort → Density → Open Folder` 순서다. 정렬과 밀도 icon의 accessible copy는 현재 상태와 click 후 결과를 함께 설명한다.
- hover에만 보이는 동작도 keyboard focus에서는 항상 보여야 한다.

### FolderTreeItem

- 상태: rest, hover, selected, drag-over, focus-visible.
- 최상위 row는 고정 `Library` label 대신 선택한 root directory의 basename을 사용한다.
- Human FolderTree의 depth는 padding token으로 표현하고 folder icon과 이름을 제공한다. AI folder/file 탐색은 별도 FileExplorerTree 계약을 따른다.
- selected row는 7px radius와 `--space-tint`/`--space-text`를 사용하며 숫자 count는 표시하지 않는다.

### FileExplorerTree

- AI 전용 read-only explorer이며 Human `FolderTree`와 분리한다.
- unpinned root row는 folder basename, pinned root row는 `[label] folder basename`을 표시한다. tooltip과 accessible name에는 canonical 전체 root를 유지한다.
- root 아래 folder와 Markdown file을 이름순으로 섞어 표시한다. folder row click은 해당 folder를 선택하고 branch를 inline expand/collapse하며, file row click은 문서를 tab에 열고 parent folder를 선택한다. active AI session 복원도 같은 parent-folder selection을 적용한다.
- selected folder는 기존 `--space-tint`/`--space-text`, active file은 동일 token과 file icon을 사용한다. depth는 14px 단위이고 chevron, folder/file icon, label 순서를 유지한다.
- hidden/ignored/symlink entry와 Markdown이 없는 branch는 native snapshot에 포함하지 않는다. 가운데 Document List는 selected folder의 direct Markdown children만 표시하고 active file row를 selected로 표시한다. 선택 row가 document·snippet·density·pane-size 변화 뒤 viewport 밖이면 nearest 위치로 scroll하되 이미 보이는 row와 DOM focus는 유지한다.
- keyboard focus-visible, `aria-expanded`, active file `aria-current`, full-path tooltip을 제공하고 216px pane에서 horizontal page scroll을 만들지 않는다.

### DocumentRow

- 전역 `documentDensity`를 Human과 AI가 공유하고 `Full → Medium → Simple → Full`로 순환한다. Full은 제목, frontmatter를 제외한 본문 스니펫 최대 2줄, updated 날짜를 표시하고 Medium은 제목과 스니펫 1줄, Simple은 제목만 표시한다.
- 상태: rest, hover, selected, dragging, focus-visible.
- selected background는 pane edge에서 6px 안쪽인 9px radius `--space-tint` pill이고 제목은 `--space-text`다.

### ModeCycleButton

- Human과 AI active document 모두에 표시한다. Human은 Edit, AI는 View로 처음 열리며 두 공간 모두 같은 mode cycle을 사용한다. AI는 content 편집만 허용하고 mutation context menu나 folder/file 관리 action은 제공하지 않는다.
- `PencilLine`(Edit), `Eye`(View), `Columns2`(Split) 중 현재 mode icon 하나만 표시한다.
- tab row 우측 끝에 고정하고 click할 때 `Edit → View → Split(Edit | View) → Edit`로 순환한다.
- 현재 mode와 다음 mode를 `aria-label`·tooltip로 설명하고 별도 content header를 만들지 않는다.

### CurrentDocumentReloadButton

- 활성 문서가 있는 Human과 AI의 content header 우측 actions 맨 앞에 `RefreshCw`를 표시하며, document-list filesystem scan과 구분한다.
- 기존 icon button anatomy인 30px hit area와 15px icon을 재사용하고 localized tooltip·accessible name을 제공한다. 저장 또는 reload 중에는 disabled 처리한다.
- 클릭하면 dirty active document를 기존 persist 경계로 먼저 저장한 뒤 해당 `{ root, path }`만 disk에서 다시 읽는다. 성공은 body, frontmatter metadata, mtime, list snapshot을 갱신하되 tab identity, Human mode, AI source label은 유지한다.
- save conflict나 read failure는 현재 in-memory buffer와 tab을 유지하고 기존 error surface로 알린다.

### CurrentDocumentFind

- 활성 문서가 있을 때 `⌘F` 또는 `Ctrl+F`는 WebView 기본 검색 대신 content pane 우측 상단의 비모달 검색 overlay를 연다. workspace scan이나 index를 만들지 않고 현재 Markdown body만 대상으로 한다.
- 검색은 대소문자를 구분하지 않는 literal match다. `current/total`을 표시하고 Enter/아래 button은 다음, Shift+Enter/위 button은 이전 결과로 끝에서 처음까지 순환한다. 결과가 없으면 `0/0`이고 이동 button은 disabled다.
- Human/AI Edit는 active source range를 CodeMirror selection으로, View는 모든 rendered occurrence와 active mark를, Split은 두 surface에 같은 active result를 표시한다.
- Escape와 닫기 button은 overlay를 닫고 열기 전 focus를 복원한다. query는 문서 전환 중 유지할 수 있지만 active result는 첫 결과로 정규화하며, search state는 settings나 문서에 저장하지 않는다.

### SpaceSwitcher

- `Human Brain · Bot AI` 순서로 Lucide `Brain`/`Bot`을 중앙에 둔 두 radio를 사용한다. 가운데 화살표는 active space에서 target space를 향해 Human 선택 시 `Human → AI`, AI 선택 시 `Human ← AI`로 전환한다. 내부 키는 `intent`/`docs`로 유지한다.
- active segment는 `--space-tint`/`--space-text`, 비활성은 뉴트럴을 사용한다.
- sidebar variant 아래에는 Lucide `Folder`, 경로 끝부분과 bold 최종 폴더, Lucide `ChevronRight`를 한 줄에 배치한 clickable root 표시줄을 둔다. 전체 row click은 active space의 Markdown folder picker를 연다.
- Human/AI 전환은 navigation sidebar에만 둔다. 3-pane에서는 folder pane, folder pane이 접힌 2-pane에서는 문서 목록 pane 상단에 full switcher를 하나만 표시하며 content pane에는 현재 공간 label을 반복하지 않는다.
- switcher segment 위에는 `⌘1` badge를 겹치지 않는다. 단축키는 keyboard 동작으로만 유지한다.
- 상태: rest, hover, active, focus-visible, saving-disabled. radiogroup/radio semantics와 전환 대상 `aria-label`을 제공한다.

### AppIcon

- 기존의 warm cream paper squircle, 촉감 있는 종이 질감, 부드러운 macOS shadow를 유지한다.
- **Canonical symbol contract:** Human red `Brain`, AI slate-blue `Bot`, graphite memo와 이들을 잇는 화살표를 의도된 AppIcon symbol로 허용한다. 다른 generic AI 장식이나 텍스트는 추가하지 않는다.
- 중앙 표식은 위 왼쪽 Brain, 위 오른쪽 Bot, 아래쪽 넓은 memo의 2행으로 구성한다. Brain에서 memo로 내려가고 memo에서 Bot으로 올라가는 U자형 단방향 흐름은 data/navigation 동작이 아니라 Human 생각이 memo를 거쳐 AI로 전달되는 제품 서사를 나타낸다.
- 32px에서도 세 기호와 흐름이 구분되도록 단순한 선, 넉넉한 padding, 제한된 색을 사용한다.

### PaneLayoutButton

- tab row 맨 왼쪽, 첫 tab 바로 앞에 `PanelLeft` icon-only control 하나를 둔다.
- 숫자나 cycle arrow를 노출하지 않고 click할 때 `3-pane → 2-pane → content-only → 3-pane`으로 전환한다.
- content header의 좌우 cycle control은 같은 42px edge cell을 사용하고 current/next state를 설명하는 `aria-label`·tooltip을 제공한다.

### ActiveRoot / AI Folder Tabs

- sidebar에서는 현재 공간의 source만 SpaceSwitcher 바로 아래 Source Card로 표시한다. Human card는 정확히 78px인 39px 두 줄을 유지한다.
- Human Source Card는 기존 `Tasteful Intent Library` label과 root picker anatomy를 유지한다.
- AI Source Card는 39px header와 최대 네 줄까지 자연스럽게 늘어나는 root path list로 구성한다. header는 pinned label shortcut group 뒤에 `Open AI Folder` action을 표시하고, 아래 fixed-font list는 pinned 여부와 관계없이 모든 열린 root를 한 줄씩 표시하며 네 줄을 넘으면 card 안에서 세로 scroll한다. visible path는 canonical 전체 경로 대신 항상 끝 두 segment를 `…/parent/leaf`로 표시하고, pinned row만 `label | …/parent/leaf`처럼 label을 앞에 붙인다. tooltip과 accessible name에는 canonical 전체 root를 유지한다. pin은 전역 mode가 아니라 `label !== null`인 tab 속성이다.
- header의 pinned shortcut은 root를 즉시 활성화하는 label-only button이다. list의 각 root row는 즉시 활성화하는 full-path primary button, direct Pin toggle, root를 바꾸지 않는 전용 ellipsis menu button을 분리한다. Pin toggle은 항상 enabled이며 unpinned에서는 muted outline, pinned에서는 `--space-tint`/`--space-text`와 filled icon으로 상태를 표현한다. unpinned toggle click은 기존 label dialog를 열고 저장 성공 후 pin하며, pinned toggle click은 확인 없이 즉시 unpin한다. ellipsis menu는 pinned에서 `Edit label`, unpinned에서 `Close`만 제공하고 unavailable root에는 targeted `Refresh`를 추가한다.
- ellipsis는 `aria-haspopup="menu"`와 `aria-expanded`를 제공하고 첫 item focus, Arrow Up/Down, Home/End, Enter/Space, Esc, outside click을 지원한다. dialog와 menu 종료 후 원래 root opener로 focus를 복원하며 Unpin은 이동한 동일 root, Close는 오른쪽 우선·왼쪽 차선 root, 빈 목록은 Open AI Folder로 focus를 옮긴다.
- Pin은 basename 앞 1~2 grapheme을 editable 기본값으로 제안하고 pinned group 맨 뒤로 옮긴다. Unpin은 session을 유지한 채 unpinned group 맨 앞으로 옮긴다. label 중복을 허용하며 Edit label은 root, 순서, active root, session을 유지한다. pinned tab은 Unpin 전에는 닫을 수 없다.
- 새 canonical root는 tab으로 추가하고 exact root 재선택은 기존 tab을 활성화한다. ancestor/descendant 관계는 허용한다. root 전환은 모든 열린 문서 save와 target scan 성공 후에만 settings와 mounted workspace를 변경한다.
- missing root는 tab, optional label, root-local session을 유지한다. 선택 실패는 현재 workspace를 유지하고 대상만 unavailable로 표시하며, targeted Refresh 성공 후에만 활성화한다.
- root close는 target을 다시 scan하지 않는다. active unpinned tab을 닫으면 오른쪽 우선, 없으면 왼쪽 root를 선택하고 해당 session만 제거한다. Pin, Unpin, Edit label은 mounted workspace를 바꾸지 않아 save barrier가 필요 없다.
- settings는 `settingsSchemaVersion: 2`, `docsRoots`, `docsRoot`, root-indexed `tabSessions.docs`를 사용한다. 저장 성공 후에만 React state와 mounted workspace를 변경하며 Explorer navigation과 availability는 root별 runtime-only map이다.
- AI는 in-app folder picker만 제공하고 외부 drag/drop은 이 slice에 포함하지 않는다. tooltip과 accessible name에는 canonical 전체 root/path를 유지한다.
- folder pane이 숨겨진 2-pane fallback은 동일 AI Source Card를 문서 목록 pane에 한 번만 표시하고 content-only에는 반복하지 않는다.

### SettingsDialog

- navigation sidebar 하단의 Lucide `Settings` icon과 localized label button으로 중앙 modal을 연다. label은 English 기본에서 `Settings`, 한국어 활성 시 `설정`이며 application chrome 언어와 함께 즉시 바뀐다. 3-pane에서는 folder pane, 2-pane에서는 document-list pane이 정확히 하나를 소유하고 content-only에서는 표시하지 않는다.
- modal은 왼쪽 navigation과 오른쪽 content의 2열 구조다. navigation은 `Appearance`, `Typography`, `Language`를 제공하고 현재 section만 선택 상태로 표시한다.
- Appearance의 `Theme` fieldset에는 Light, Two-Tone, Dark, System을 2×2 radio tile로 배치한다. 각 tile은 3-pane surface mini preview, label, selection indicator를 포함하고 선택 즉시 앱 전체에 적용·저장한다. Two-Tone의 내부 key는 `charcoal`이다.
- Appearance의 `Human·AI colors` fieldset은 Theme 아래에 Classic, Terracotta & Teal, Plum & Moss, Mono Duo를 2×2 radio tile로 배치한다. 각 tile은 Human/AI 2분할 swatch와 label, selection indicator를 포함하며 Theme을 바꾸지 않고 즉시 앱 전체에 적용·저장한다. 내부 기본 key는 `classic`이다.
- Typography는 Sans-serif와 Serif, Language는 English와 한국어를 각각 동일 크기의 2-column radio card로 제공한다. 두 section 모두 glyph·label·설명·selection indicator와 바로 아래 live preview를 공유한다.
- Sans-serif와 English가 clean settings의 기본값이다. 글꼴과 언어 선택은 즉시 적용하고 `settings.json`에 저장한다. Language는 application chrome·dialog·action·accessibility copy와 문서 `lang`을 전환하되 사용자 파일·폴더명, Markdown 제목·본문, filesystem path는 번역하지 않는다.
- 열릴 때 현재 section의 선택 radio에 focus하고 Tab/Shift+Tab focus trap, Esc, visible 닫기 button을 제공한다. 닫히면 dialog를 연 원래 button(English 기본 `Settings`, 한국어 활성 시 `설정`)으로 focus를 복원하며 Settings 전용 shortcut은 추가하지 않는다.
- 작은 창에서는 modal 전체가 아니라 오른쪽 content column만 세로 스크롤해 Theme과 네 Space Palette tile 및 닫기 control에 계속 접근할 수 있다. 온보딩 카드도 viewport 높이에 고정된 자체 스크롤로 상단 설명부터 navigation까지 접근 가능하다.

### TabBar / TabItem

- content pane 상단 고정 1줄이며 leading pane control, scroll 가능한 tab list, 우측 고정 actions로 나눈다.
- 순서는 `pane control | tabs | current-document reload | PDF export | transient save status | mode cycle`이다. reload, PDF export, save status, mode icon은 Human/AI 공통이고 mode icon은 항상 맨 오른쪽이다. PDF export는 현재 렌더 Markdown을 macOS system print dialog로 보내 Save as PDF를 사용하며 앱 chrome은 인쇄하지 않는다. pane/mode cycle은 동일한 42px edge cell이고, save status는 dirty/saving/error 상태에서만 노출한다.
- 상태: rest, hover, active, dirty/saving/error, focus-visible.
- active tab은 `--space-accent` 2px 하단선과 text weight로 구분하고, overflow는 가로 scroll로 처리한다.
- 닫기 button은 30px hit area와 문서 제목을 포함한 `aria-label`을 사용한다.
- Human tab은 기존 single-line 제목을 유지한다. AI tab도 root-local single-line 제목을 사용하고 source badge를 표시하지 않는다.
- Pin custom label은 root switcher와 Explorer root row에만 표시하며 tab identity로 사용하지 않는다.
- AI tab tooltip·accessible name에는 canonical 전체 경로를 포함한다. 하나의 header row와 가로 overflow를 유지하고 leading/trailing edge control 높이를 맞춘다.

### ContextMenu

- `Rename…`, `Move…`, `Move to Trash` 세 명령만 제공하며 중첩 submenu를 사용하지 않는다.
- modal과 공유하는 단일 soft shadow, control radius 6px, panel/content token만 사용한다.
- mouse 우클릭, Context Menu key, `⇧F10`으로 열고 첫 항목에 focus한다.
- Arrow Up/Down, Home/End, Enter/Space, Esc를 지원하고 종료 후 opener로 focus를 복귀한다.
- 상태: closed, open, item-hover, item-focus, danger-focus.

### NameDialog

- 새 의도·새 폴더·문서/폴더 이름 변경이 공유하며 single-line 이름 input과 cancel/submit action을 제공한다.
- 유효한 이름에서 Enter와 submit button은 동일한 form submit 경로를 사용한다. 공백 또는 제출 중에는 다시 제출하지 않고 IME 조합 중 Enter는 조합 확정에만 사용한다.
- Esc 취소, 초기 input focus, 종료 후 opener focus 복원을 유지한다.

### MoveDialog

- 문서·폴더가 공유하며 이동 가능한 destination folder만 표시한다.
- 현재 parent와 folder 자기 자신·하위 경로는 제외한다.
- 상태·focus trap·Esc·submit/cancel은 기존 NameDialog modal anatomy를 따른다.

### IconButton

- 30px hit area, Lucide icon 15px.
- 상태: rest, hover, active, focus-visible, disabled, danger.
- tooltip 또는 `aria-label` 없이 icon-only button을 사용하지 않는다.

### MarkdownEditor

- CodeMirror root가 content scroll owner가 되며 source text 이외의 toolbar는 없다.
- syntax tree의 Markdown marker node만 `--space-text`로 표시하고 heading·paragraph text는 뉴트럴을 유지한다. caret와 selection은 공간색을 사용한다.
- 상태: ready, saving, saved, conflict/error.

### MarkdownView

- prose hierarchy, GFM table/code/list를 지원하며 interactive editor control은 없다.
- Split mode에서는 MarkdownEditor와 MarkdownView가 동일 폭의 두 column을 소유하고 각자 scroll한다.
- AI space에서만 rendered body 첫 줄 위에 `--muted`·`--fixed-font`·`--type-sm`의 document-path 라인을 표시한다. 표시는 `…/parent/file.md` 끝 두 segment, tooltip은 canonical 전체 경로이며 content와 함께 scroll된다. 경로 텍스트 뒤에 파일 이름 복사(`FileText` + 파일명 라벨)와 파일 이름 포함 canonical 전체 경로 복사(`FolderTree` + 전체 경로 라벨)용 pill 버튼 두 개가 이어지며, 복사 성공 시 해당 아이콘이 잠시 체크 표시로 바뀌고 버튼이 `--space-accent`로 강조된다. 같은 성공 상태는 현재 언어의 polite live-region 메시지로 보조 기술에도 전달한다. pill 버튼 뒤 라인 오른쪽 끝에는 `History` 아이콘과 `--type-xs` on-disk 수정 시각 `<time>`이 이어진다. Human space와 PDF export에는 표시하지 않고 별도 header를 만들지 않는다.

### InlineNotice

- conflict와 filesystem error를 content header 아래에 표시한다.
- dismiss 또는 재시도 action이 있을 때만 button을 렌더링한다.

### EmptyState

- 대형 한 문장과 다음 행동 하나만 제공한다.
- illustration, card grid, tutorial carousel은 사용하지 않는다.

### Primitive Showcase

개발용 `?showcase=1` surface에서 위 interactive primitive의 rest, hover 설명, selected, focus, error, empty 상태를 한 화면에 노출한다. 제품 route와 같은 token stylesheet를 사용한다.

## 6. Motion & Interaction

### Timing

- 즉시 feedback: 80ms.
- pane 전환: 180ms `cubic-bezier(0.2, 0.8, 0.2, 1)`.
- hover/focus color: 120ms ease-out.

### Rules

- pane 폭 전환은 grid column interpolation으로만 사용하고 content 입력 중 layout animation을 시작하지 않는다.
- space switcher는 180ms standard timing으로 active indicator만 전환하며 root load가 끝나기 전에 decorative transition을 추가하지 않는다.
- tab activation은 즉시 반응하고 scroll overflow 외 layout animation을 사용하지 않는다.
- autosave는 motion이 아니라 text status로 알린다.
- `prefers-reduced-motion: reduce`에서는 모든 전환 시간을 1ms로 낮춘다.
- decorative loop, bounce, glow pulse를 금지한다.

## 7. Depth & Surface

### Strategy

- depth는 canvas/panel/content의 미세한 명도 차이와 separator로만 표현한다.
- modal과 context menu에만 단일 soft shadow를 허용한다.
- 모든 row를 card로 만들거나 중첩 rounded container를 사용하지 않는다.
- radius는 control 6px, selected row 8px, modal 12px로 제한한다.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- 모든 CRUD action은 keyboard로 도달 가능해야 한다.
- `⌘1`, `⌘2` 외 기능에는 단축키가 없어도 visible control이 있어야 한다.
- focus ring은 배경과 3:1 이상 대비를 유지한다.
- body text와 UI text는 WCAG AA 대비를 유지한다.
- destructive action은 확인 후 실행하고 시스템 Trash 실패 시 원본 보존을 명시한다.
- drag-and-drop move에는 keyboard 대체 move control을 함께 제공한다.
- editor와 rendered content에서 한글 조합·줄바꿈·glyph fallback을 실제 화면으로 검증한다.

### Accepted Debt

- v0.2는 Sans-serif·Serif writing typography와 Light·Two-Tone·Dark·System theme, English·한국어 UI를 제공하며 typography에서는 font size와 custom font만 제외한다.
- Windows IME는 macOS 첫 release gate 밖이며 Windows 배포 전 별도 검증한다.
- v0.2는 tab 전환·닫기와 space 전환 전용 shortcut을 추가하지 않는다. visible SpaceSwitcher와 tab close button을 우선한다.
