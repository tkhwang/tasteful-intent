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
| `--selection` / `--selection-text` | dialog 등 공간과 무관한 선택 상태 |
| `--danger` | destructive action |

### Rules

- `data-theme`은 Light(기본), Two-Tone, Dark를 표현하고 System은 runtime에서 OS light/dark로 해석한다. Two-Tone의 내부 `data-theme`·저장 key는 호환을 위해 `charcoal`을 유지한다.
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

- UI control과 application chrome은 `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Noto Sans KR`, sans-serif로 고정한다.
- 글쓰기 surface는 macOS system font만 사용하는 `--writing-font`로 분리한다. Sans-serif 기본값은 `Avenir Next`, `Apple SD Gothic Neo` 계열이고 Serif는 `Iowan Old Style`, `AppleMyungjo` 계열이다.
- 선택한 writing font는 Markdown editor·rendered view·큰 빈 화면 문구에만 적용한다. inline code와 code block은 `SFMono-Regular`, `Cascadia Code`, monospace를 유지한다.

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
- `libraryRoot`가 없는 onboarding은 `언어 → 테마 → Human 폴더` 3단계다. 언어 English와 테마 Two-Tone을 pre-select하고 즉시 적용하며 둘 다 skip할 수 있다. Human 폴더는 필수다.
- AI에는 folder setup 단계가 없다. 열린 AI 문서가 없으면 Open File welcome을 표시하고, 선택한 문서에서 source path를 파생한다.
- ready 상태만 `FolderPane`, `DocumentList`, `ContentPane`을 렌더링한다.

### PaneHeader

- label, 현재 경로 또는 mode, 필요한 icon button 최대 4개.
- document list header action은 `RefreshCw → ArrowDownWideNarrow/ArrowDownAZ 정렬 toggle → Rows4/Rows3/Rows2 밀도 cycle → Plus` 순서다. Human의 `Plus`는 create, AI의 `Plus`는 Open File이다. 정렬과 밀도 icon의 accessible copy는 현재 상태와 click 후 결과를 함께 설명한다.
- hover에만 보이는 동작도 keyboard focus에서는 항상 보여야 한다.

### FolderTreeItem

- 상태: rest, hover, selected, drag-over, focus-visible.
- 최상위 row는 고정 `Library` label 대신 선택한 root directory의 basename을 사용한다.
- depth는 padding token으로 표현하고 folder icon과 이름을 제공한다.
- selected row는 7px radius와 `--space-tint`/`--space-text`를 사용하며 숫자 count는 표시하지 않는다.

### DocumentRow

- 전역 `documentDensity`를 Human과 AI가 공유하고 `Full → Medium → Simple → Full`로 순환한다. Full은 제목, frontmatter를 제외한 본문 스니펫 최대 2줄, updated 날짜를 표시하고 Medium은 제목과 스니펫 1줄, Simple은 제목만 표시한다.
- 상태: rest, hover, selected, dragging, focus-visible.
- selected background는 pane edge에서 6px 안쪽인 9px radius `--space-tint` pill이고 제목은 `--space-text`다.

### ModeCycleButton

- Human 문서에만 표시한다. AI 문서는 read-only View이며 mode cycle이나 mutation context menu를 제공하지 않는다.
- `PencilLine`(Edit), `Eye`(View), `Columns2`(Split) 중 현재 mode icon 하나만 표시한다.
- tab row 우측 끝에 고정하고 click할 때 `Edit → View → Split(Edit | View) → Edit`로 순환한다.
- 현재 mode와 다음 mode를 `aria-label`·tooltip로 설명하고 별도 content header를 만들지 않는다.

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

### ActiveRoot / AI Path Shortcuts

- sidebar에서는 현재 공간의 source만 SpaceSwitcher 바로 아래 고정 높이 2단 Source Card로 표시한다. Human/AI 전환 시 카드 높이와 folder tree 시작 위치는 움직이지 않으며, 내부 content만 교체한다.
- Human Source Card 첫 줄은 비활성 workspace label `Tasteful Intent Library`, 둘째 줄은 `Folder | 부모 경로 + 최종 폴더 | ChevronRight` folder picker다. 부모 경로는 `--sidebar-muted`로 말줄임 처리하고 최종 폴더와 양쪽 icon은 `--space-text`로 구분한다.
- AI Source Card 첫 줄은 open document 순서와 1:1인 `A | B | C` 30px square shortcut과 끝의 30px `FilePlus2` Open File action, 둘째 줄은 `active 문자 | canonical file path | ChevronDown` current-source control이다. 값은 사용자가 선택하거나 등록한 folder가 아니라 active open document에서 자동 파생한다.
- active-root row를 펼치면 shortcut 아래에 open document 순서와 1:1인 dropdown을 표시한다. 각 row는 square 문자, parent folder명, canonical 전체 file path, active check를 포함한다.
- dropdown row와 shortcut은 동일한 전환 함수를 사용해 연결 문서, base path, 2nd pane을 함께 이동한다. 각 button의 tooltip·accessible name은 `문자: canonical 전체 파일 path`를 제공한다.
- shortcut row 끝의 `FilePlus2`는 폴더 등록이 아니라 Markdown Open File만 실행하며 localized tooltip과 accessible label을 유지한다. add/remove/context menu는 제공하지 않으며 긴 목록은 가로 overflow로 유지한다.
- dropdown이 열려도 Source Card와 A/B/C shortcut은 가리지 않으며 menu는 고정 높이 카드 아래에서 folder tree 위로 펼쳐진다. hover와 `focus-visible`은 배경뿐 아니라 고대비 border와 2px 외곽 ring으로 구분한다.
- dropdown copy column은 folder명과 canonical path를 trailing-align한다. path overflow는 LTR 문자 순서를 유지한 채 마지막 parent/file segment를 우선 노출하고 full canonical path는 tooltip과 accessible name에 유지한다.
- dropdown close 성공 후 menu를 유지하고 active/remaining 선택 row로 keyboard focus를 복구한다. 마지막 문서 close는 switcher unmount와 AI welcome 전환으로 종료한다.
- AI open document가 없으면 같은 SpaceSwitcher와 Open File welcome/action만 표시한다.
- folder pane이 숨겨진 2-pane fallback에서는 Human root를 반복하지 않지만 AI shortcut row는 문서 전환을 위해 유지한다. content toolbar와 content-only에는 root를 반복하지 않는다.
- Human 클릭은 folder picker를 연다. AI path는 열린 문서에서만 파생하며 Human root와 AI source path를 한 화면에 함께 나열하지 않는다.

### SettingsDialog

- navigation sidebar 하단의 Lucide `Settings` icon과 localized label button으로 중앙 modal을 연다. label은 English 기본에서 `Settings`, 한국어 활성 시 `설정`이며 application chrome 언어와 함께 즉시 바뀐다. 3-pane에서는 folder pane, 2-pane에서는 document-list pane이 정확히 하나를 소유하고 content-only에서는 표시하지 않는다.
- modal은 왼쪽 navigation과 오른쪽 content의 2열 구조다. navigation은 `Appearance`, `Typography`, `Language`를 제공하고 현재 section만 선택 상태로 표시한다.
- Appearance의 `Theme` fieldset에는 Light, Two-Tone, Dark, System을 2×2 radio tile로 배치한다. 각 tile은 3-pane surface mini preview, label, selection indicator를 포함하고 선택 즉시 앱 전체에 적용·저장한다. Two-Tone의 내부 key는 `charcoal`이다.
- Typography는 Sans-serif와 Serif, Language는 English와 한국어를 각각 동일 크기의 2-column radio card로 제공한다. 두 section 모두 glyph·label·설명·selection indicator와 바로 아래 live preview를 공유한다.
- Sans-serif와 English가 clean settings의 기본값이다. 글꼴과 언어 선택은 즉시 적용하고 `settings.json`에 저장한다. Language는 application chrome·dialog·action·accessibility copy와 문서 `lang`을 전환하되 사용자 파일·폴더명, Markdown 제목·본문, filesystem path는 번역하지 않는다.
- 열릴 때 현재 section의 선택 radio에 focus하고 Tab/Shift+Tab focus trap, Esc, visible 닫기 button을 제공한다. 닫히면 dialog를 연 원래 button(English 기본 `Settings`, 한국어 활성 시 `설정`)으로 focus를 복원하며 Settings 전용 shortcut은 추가하지 않는다.

### TabBar / TabItem

- content pane 상단 고정 1줄이며 leading pane control, scroll 가능한 tab list, 우측 고정 actions로 나눈다.
- 순서는 `pane control | tabs | transient save status | mode cycle`이며 mode icon이 항상 맨 오른쪽이다. pane/mode cycle은 동일한 42px edge cell이고, save status는 dirty/saving/error 상태에서만 노출한다.
- 상태: rest, hover, active, dirty/saving/error, focus-visible.
- active tab은 `--space-accent` 2px 하단선과 text weight로 구분하고, overflow는 가로 scroll로 처리한다.
- 닫기 button은 30px hit area와 문서 제목을 포함한 `aria-label`을 사용한다.
- Human tab은 기존 단일-line 제목을 유지한다. 모든 AI tab은 첫 줄에 compact source-letter badge와 제목, 둘째 줄에 muted `root basename / relative parent folder`를 표시하고 root 직속 문서는 basename만 표시한다. 둘째 줄에는 filename을 반복하지 않는다.
- AI tab badge와 Source Card shortcut은 같은 open-document 순서에서 파생하고 close 후 함께 재번호화한다. badge는 `{ root, path }` identity를 대체하거나 settings에 저장하지 않으며 Human tab에는 표시하지 않는다.
- AI의 screen label은 각 줄을 ellipsis 처리하고 tooltip·accessible name에는 source letter, canonical root와 전체 상대경로를 포함한다. 2-line tab도 하나의 header row와 가로 overflow를 유지하며 leading/trailing edge control 높이를 맞춘다.

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
