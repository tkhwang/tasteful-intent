# Plan: 최초 실행 onboarding + 문서 정렬·새로 고침 + AI Open File path

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

작성일: 2026-08-09
상태: 구현·검증 완료
브랜치: `feat/update-0809`
관련: `docs/specs/intent-memo.md` §5 · `DESIGN.md` AppShell/PaneHeader/ActiveRoot/SettingsDialog · `CLAUDE.md` UI Contract · UI 확정 목업 <https://claude.ai/code/artifact/b9bb6894-4357-44a2-a3d3-6e2bc83bdfd2>

**Goal:** (1) 클린 최초 실행에 `언어 → 테마 → Human 폴더` 3단계 onboarding wizard를 도입하고, (2) 문서 목록에 최신 순↔제목 순 정렬 토글과 재스캔 refresh를 추가하며, (3) AI 공간에서 `Open File`로 연 문서의 source folder를 자동 파생해 여러 위치 사이를 빠르게 전환할 수 있게 한다.

## 배경 (현재 구조)

- 온보딩: `App.tsx` `RuntimeContent`가 active space의 root가 없으면 공간별 welcome 화면(`WelcomeScreen`/`DocsWelcomeScreen`)을 표시한다. 언어·테마 선택은 온보딩에 없다.
- 문서 목록 정렬: Rust `scan_library`가 `updatedMs` 내림차순 고정으로 반환한다(`src-tauri/src/library.rs:77`). 프론트 정렬 옵션은 없다.
- 새로 고침: `useLibraryWorkspace` 내부에 `refresh()`(scanLibrary 재실행)가 이미 있으나 반환 객체로 노출되지 않는다(`src/hooks/useLibraryWorkspace.ts:108`).
- root 모델: Human은 사용자 선택 `libraryRoot` 하나를 유지한다. AI는 사용자가 root를 등록하지 않고, OS `Open File`로 연 파일의 canonical parent folder를 해당 문서의 `root`로 사용한다. `docsRoot`는 현재 browse 위치의 projection일 뿐 별도 root 목록의 source of truth가 아니다.
- tab session: Human은 root-relative path session, AI는 canonical `{ root, path }` reference session 하나를 사용한다. AI path switcher는 이 session/runtime open documents를 순서 그대로 1:1 투영한다.
- 재사용 primitive: SettingsDialog의 theme tile(`theme-tile-grid`)·choice card(`settings-choice-grid`) CSS는 전역 클래스라 온보딩에서 재사용 가능. `ContextMenu`·`MoveDialog`·`formatRootDisplay` 존재.

참고: Phase A는 이 branch에서 한 차례 구현·검증(테스트 88개 통과, `pnpm check`/`pnpm build` 클린) 후 계획 확정을 위해 전체 rollback한 이력이 있어 확정도가 높다.

## 확정된 결정

| 결정 | 요지 |
|---|---|
| 온보딩 트리거 | `libraryRoot`가 비어 있는 클린 최초 실행에만 3단계 wizard를 표시한다. AI는 folder setup 단계가 없고, AI 공간에 처음 진입했을 때 `Open File` welcome을 표시한다. |
| 온보딩 커밋 시점 | 언어·테마는 선택 즉시 적용·저장(라이브 반영). Human 폴더는 마지막 단계 선택 시 저장하고 onboarding을 완료한다. |
| 단계별 skip·기본값 | 언어·테마는 건너뛸 수 있고 Human 폴더만 필수다. skip 기본값: 언어 = English, 테마 = Two-Tone(`charcoal`). 단계 진입 시 기본값을 pre-select + 라이브 적용한다. |
| 테마 기본값 주의 | clean settings의 저장 기본값은 spec대로 `light`를 유지하되, 온보딩 테마 단계를 건너뛰면 `charcoal`이 저장된다. 신규 사용자의 사실상 기본 테마가 Two-Tone이 되는 것은 의도된 결정이다. |
| 정렬 모델 | 사용자 확정: 전역 `documentSort`(`"updated"` 기본 \| `"title"`) 하나를 `settings.json`에 저장·복원해 Human·AI와 모든 root에서 공유한다. 정렬은 프론트 memo에서 수행(Rust 무변경)한다. 제목 정렬은 현재 UI 언어의 `Intl.Collator(language, { numeric: true, sensitivity: "base" })`를 재사용하고 동일 제목은 root-relative `path`로 tie-break해 안정화한다. |
| 정렬·refresh 컨트롤 (4-A·2-A 확정) | 문서 목록 pane 헤더에 `[RefreshCw][정렬 토글][+]` icon button 3개. 정렬은 토글 1개(`ArrowDownWideNarrow` 최신 순 / `ArrowDownAZ` 제목 순)로 "현재 상태 · 클릭 결과" aria-label/tooltip 패턴을 따른다. DESIGN.md PaneHeader 규칙을 최대 3개로 완화한다. |
| refresh 동작 | 훅의 기존 `refresh`를 노출만 한다. 스니펫 캐시가 `path+updatedMs` 키라 변경 파일만 자동 재조회된다. |
| AI 다중 root 모델 | 사용자가 AI root를 등록·추가·제거하지 않는다. OS `Open File`로 선택한 Markdown 파일의 canonical parent folder가 해당 문서의 source `root`가 된다. 새로운 parent면 switcher에 자동 등장한다. |
| AI path 생명주기 | 사용자 확정 A: path 목록은 현재 열린 AI 문서와 1:1로 연결된 projection이다. 문서를 닫으면 연결된 path 항목도 즉시 사라진다. 별도 folder/recent-path history는 저장하지 않는다. |
| AI runtime 탭 범위 | 앱 실행 중 열린 AI 문서는 root별로 나누지 않고 모든 source root를 아우르는 runtime open-document list 하나로 관리한다. 다른 root tab을 선택하면 그 tab의 `{ root, path }`에서 browse root와 folder tree를 파생한다. |
| AI 탭 재시작 복원 | AI 전역 탭의 canonical `{ root, path }` reference 목록과 active reference만 settings에 저장해 재실행 후 복원한다. 파일 내용·cursor·scroll은 저장하지 않는다. 존재하지 않는 reference는 해당 항목만 제외한다. 복원된 reference가 root 목록도 재구성한다. |
| AI 탐색 source of truth | active AI file의 `{ root, path }`가 현재 탐색 위치를 정한다. A/B path 항목은 각각 자신을 만든 open document와 연결되며, 항목 선택은 그 문서를 활성화하고 동시에 해당 문서의 base path와 2nd pane을 이동한다. 별도 사용자 관리 base path는 없다. |
| AI 탭 문서 identity | `DocsDocumentRef = { root: string; path: string }`. OS `Open File`로 연 문서는 `root = canonical parent`, `path = filename`; 이후 해당 root 탐색 목록에서 연 문서는 동일 root 기준 상대경로를 유지한다. |
| 구현 Phase 순서 | 사용자 확정: Phase A(onboarding·정렬·refresh)를 구현하고 전체 검증과 Tauri smoke를 통과한 뒤에만 Phase B(AI 다중 root·cross-root tabs)를 시작한다. 두 Phase를 한 번에 통합 구현하지 않는다. |
| 신규 UI component 배치 | repository의 flat component convention을 유지해 `src/components/OnboardingScreen.tsx`와 `src/components/DocsRootSwitcher.tsx`에 둔다. `DocsRootSwitcher`는 관리 UI가 아니라 파생 목록 전환 UI다. |
| AI root 영속 identity | OS file path는 native 경계에서 canonicalize한 뒤 parent/filename으로 분해한다. `DocsDocumentRef.root`에 canonical parent를 저장하고, 동일 실체를 alias 경로로 다시 열면 composite identity로 dedupe한다. |
| cross-root tab label | 사용자 확정: 모든 AI tab은 2줄로 표시한다. 첫 줄은 Title, 둘째 줄은 muted gray `root basename / relative parent folder`다. filename은 Title에 이미 있으므로 path 줄에서 반복하지 않는다. root 바로 아래 문서는 parent를 생략하고 root basename만 표시한다. tab bar는 content pane의 단일 header row를 유지하며 Human tab은 기존 단일-line 계약을 유지한다. |
| switcher UI | Human/AI는 고정 높이 2단 Source Card를 공유해 전환 시 folder tree 시작 위치가 움직이지 않는다. Human은 `Tasteful Intent Library` / current folder path, AI는 `A | B | C +` / active 문자·canonical file path 순서다. AI dropdown은 카드 아래에서 tree 위로 overlay되며 shortcut/dropdown row는 같은 document 전환을 실행한다. `+`는 Markdown Open File만 실행하고 folder 관리 UI는 없다. |
| root 전환 안전 절차 | switcher 전환과 cross-root tab 활성화는 target scan이 성공한 뒤에만 browse 위치를 바꾼다. AI가 read-only이므로 전환을 위한 dirty save barrier는 없다. |
| cross-root 파일 이동 | 범위 외. MoveDialog·native 명령·안전 계약(§7)이 단일 root 경계를 전제하므로 별도 과제로 분리한다. |
| 온보딩과 AI 결합 | onboarding에는 AI folder 단계가 없다. AI 공간의 초기 화면과 workspace의 open control 모두 OS file picker를 연다. |

## 결정 Gate

- [x] **AI onboarding** — 사용자 정정: AI folder 단계 자체를 제거한다. 언어·테마는 skip 가능하고 Human 폴더만 필수다.
- [x] **정렬 UI 형태** — 토글 icon button 1개(2-A)로 확정. 정렬 기준이 3개 이상으로 늘면 메뉴로 확장한다.
- [x] **정렬·refresh 버튼 위치** — 문서 목록 헤더 3개(4-A)로 확정. `DESIGN.md` PaneHeader "icon button 최대 2개"를 3개로 완화한다.
- [x] **AI root switcher UI** — 사용자 HTML 시안 확정: active file-derived 현재 folder row + shortcut 아래 dropdown + 항상 보이는 square `A | B | C`. dropdown/문자는 같은 document 전환이며 `+`는 Open File, 수동 folder 추가·제거 affordance는 없다.
- [x] **Human/AI Source Card anatomy** — 사용자 확정: 고정 높이 2단 카드로 tree 시작 위치를 고정한다. Human은 `Tasteful Intent Library` / folder path, AI는 `A | B | C +` / active path 순서다.
- [x] **정렬 저장 범위** — 사용자 최종 확정: Human·AI와 모든 root가 전역 `documentSort` 하나를 공유한다. 범위별 저장안은 철회한다.
- [x] **AI runtime 탭 범위** — 사용자 확정: 열린 파일에서 파생된 모든 AI root를 가로지르는 실행 중 open-document list 하나.
- [x] **AI 탭 재시작 복원** — 사용자 확정: `{ root, path }` 목록과 active reference만 settings에 저장·복원한다. 파일 내용과 runtime buffer는 저장하지 않는다.
- [x] **AI 탐색 source of truth** — 사용자 정정: root는 OS `Open File` 문서의 canonical parent에서 자동 파생하며 사용자가 등록하거나 관리하지 않는다.
- [x] **AI 탭 문서 identity** — `{ root, path }`; OS에서 직접 연 파일은 canonical parent + filename, root 내부 목록에서 연 파일은 해당 source root 상대 path다.
- [x] **AI path 생명주기** — 사용자 A 확정: 현재 열린 tab이 path 목록의 유일한 source다. tab을 닫으면 연결된 path 항목도 사라진다.
- [x] **Phase 순서** — 사용자 확정: A 완료·검증 → B 순차. Phase A gate가 실패하면 Phase B를 시작하지 않는다.
- [x] **신규 UI component 파일 배치** — 사용자 확정: `src/components/OnboardingScreen.tsx`, `src/components/DocsRootSwitcher.tsx` flat 배치.
- [x] **AI root 영속 identity** — canonical `{ root, path }` tab reference만 저장한다. 별도 `docsRoots` history는 저장하지 않는다.
- [x] **cross-root tab label** — 사용자 확정: 모든 AI tab에 `Title` / muted gray `path` 2줄을 항상 표시한다.
- [x] **AI tab path copy** — 사용자 확정: 둘째 줄은 `root basename / relative parent folder`. filename은 첫 줄 Title에서만 표시하고, tooltip·accessible name은 canonical root + 전체 상대경로를 유지한다.

## 구현 불변식

- AI path 목록은 `openDocuments` 순서와 동일한 1:1 projection이다. 별도 등록 목록이나 distinct-folder/recent-folder history를 갖지 않는다.
- 유효한 AI document reference는 canonical `{ root, path }`이며 `path`는 해당 source root 내부의 정규화된 상대 Markdown 경로다. runtime/settings 어느 곳에서도 path 단독으로 AI 문서를 식별하지 않는다.
- AI open-document map, save promise, snippet cache/request key는 모두 `root + NUL + path` composite identity를 사용한다. 서로 다른 root의 동일 상대경로는 충돌하지 않는다.
- tab 또는 path 항목 선택 시 같은 `activateDocument({root,path})` 경계를 사용해 `docsRoot = active.root`, 선택 folder = `parent(active.path)`, 2nd pane snapshot = `active.root`의 scan 결과로 함께 이동한다.
- `DocsTabSession.active`는 `documents`의 원소이거나 `null`이다. load 시 invalid/missing reference는 개별 제거하고, active가 제거되면 첫 유효 reference 또는 `null`로 복구한다.
- OS `Open File`은 Markdown 파일만 허용하고 native canonicalization/regular-file 검증이 성공한 뒤 runtime/session에 추가한다. 실패 시 기존 browse root·active tab·open buffers를 유지한다.
- 마지막 tab close 시 해당 root projection도 사라진다. active close fallback은 기존 전역 tab 순서의 오른쪽, 없으면 왼쪽, 모두 없으면 AI welcome 순이다.

## Phase A — onboarding·정렬·새로 고침

### Task A1 — settings 데이터 모델

- [x] `src/types/library.ts`: `DOCUMENT_SORTS = ["updated", "title"]`, `DocumentSort` 타입, `LayoutSettings.documentSort` 전역 설정을 추가한다.
- [x] `src/lib/settings.ts`: `documentSort` zod enum 스키마 + default `"updated"` + save store key를 추가한다. 현재 마지막 `settingsSchema.safeParse(...)` 실패가 전체 default를 반환하는 구조를 필드별 `safeParse`로 바꿔, 한 필드의 손상이 유효한 root/theme/language/tab session까지 초기화하지 않게 한다.
- [x] `src/lib/settings.test.ts`: 전역 default·`"title"` 왕복과 함께 invalid `documentSort`, pane flag, 한쪽 tab session이 각각 해당 필드만 fallback하고 나머지 유효 settings를 보존하는 회귀 테스트를 추가한다.

검증: `pnpm test src/lib/settings.test.ts` 10 tests 통과, 관련 Biome check 통과.

### Task A2 — i18n 메시지

- [x] `src/lib/i18n.ts`: `onboarding` 블록(step 표시, 언어/테마 제목, 안내문, 계속/뒤로/건너뛰기/나중에 선택, 선택 폴더 표시)과 `app.sortLatest`/`app.sortTitle`/`app.refreshList` en·ko 추가. 폴더 단계 카피는 기존 `welcomeTitle/Body`·`docsTitle/Body`·`chooseIntentRoot/chooseDocsRoot` 재사용.

검증: `pnpm test src/lib/i18n.test.ts` 통과(구조 동형성 테스트).

### Task A3 — OnboardingScreen wizard

- [x] `src/components/OnboardingScreen.tsx` — props를 `onComplete(libraryRoot)`로 축소하고 AI folder state/UI를 제거한다.
- [x] 화면: `welcome-screen` 레이아웃 재사용 + 단계 표시(`n / 3`) + 뒤로/계속/건너뛰기 내비게이션. 언어 = Settings choice card, 테마 = theme tile, Human folder만 마지막 필수 단계다.
- [x] 건너뛰기 = 언어/테마 기본값(en/charcoal) 적용 후 다음 단계. Human folder는 plugin-dialog directory picker이며 선택 즉시 onboarding을 완료한다.
- [x] `src/index.css`: `.onboarding-*` 스타일(h1 축소, step 표시, choices 폭 `min(560px, 100%)`, nav row).

검증: Task A4의 App 통합 테스트에서 함께 검증.

### Task A4 — App 통합 (라우팅·정렬·refresh)

- [x] `src/App.tsx`: `libraryRoot === null` 분기에서 3단계 `OnboardingScreen`을 렌더하고 `onComplete`에서 Human root + `activeSpace: "intent"`만 저장한다.
- [x] `src/App.tsx` `LibraryApp`: `sortedDocuments` memo(`title`이면 현재 언어의 `Intl.Collator` + path tie-break, `updated`면 스캔 순서 유지) → `DocumentList`에 전달. 목록 헤더 버튼을 `.pane-actions`로 묶어 `[RefreshCw][정렬 토글][+]` 배치.
- [x] `src/hooks/useLibraryWorkspace.ts`: 반환 객체에 `refresh` 노출(1줄).
- [x] `src/index.css`: `.pane-header > .pane-actions` row 오버라이드(기존 `.pane-header > div`가 column flex).
- [x] `src/App.test.tsx`: 3단계 전체 플로우, AI folder 단계 부재, 언어·테마 skip 기본값, Human folder 필수와 완료 저장을 검증한다. 정렬·refresh 기존 회귀는 유지한다.

검증: `pnpm test` 전체 통과.

### Task A5 — 문서 계약 갱신 (Phase A 델타)

- [x] `CLAUDE.md` UI Contract: 온보딩을 3단계로 수정하고 AI는 Open File 기반임을 명시한다. 문서 목록 refresh·`documentSort` 계약은 유지한다.
- [x] `docs/specs/intent-memo.md`: §5.1을 3단계 onboarding으로 수정하고 AI 초기 진입은 Open File welcome으로 분리한다.
- [x] `DESIGN.md`: AppShell 온보딩 서술 교체, PaneHeader 최대 2개 → 3개 + 문서 목록 헤더 버튼 순서·아이콘 명시.

검증: 스펙 문장에 미결정 placeholder가 없고 구현이 역참조 가능.

### Task A6 — Phase A 검증

- [x] `pnpm test` → `pnpm check` → `pnpm build` 통과(Rust 무변경 시 cargo 생략 가능).
- [x] Tauri smoke: 클린 설정에서 3단계 wizard(필수 Human)와 AI Open File welcome을 실제 앱에서 확인했다. 정렬·refresh·keyboard·언어·테마 계약은 105개 자동 테스트와 actual onboarding/Light·Two-Tone/en·ko 캡처로 함께 검증했다.
- [x] Phase A 자동 검증과 production bundle 확인 후 Phase B를 통합 검증했다.

## Phase B — AI 공간 다중 root (프로젝트 전환)

### Task B1 — Open File source와 settings 모델

- [x] `src/types/library.ts`: `docsRoots`를 제거하고 `DocsDocumentRef`/`DocsTabSession`만 AI root persistence source로 유지한다.
- [x] `src-tauri/src/library.rs` + `src-tauri/src/lib.rs`: OS picker의 absolute Markdown file을 canonicalize하고 regular file/extension을 검증한 뒤 `{ root: canonical parent, path: filename }`을 반환하는 command를 추가·등록한다.
- [x] `src/lib/native.ts`: typed `resolveDocumentSource(path)` IPC adapter를 추가한다.
- [x] `src/lib/settings.ts`: `docsRoots` 저장·migration을 제거한다. legacy `docsRoot` + relative docs session은 `{ root, path }`로 이관하고, 신규 session은 개별 reference를 sanitize한다. `docsRoot`는 active/browse projection으로만 유지한다.
- [x] tests: regular Markdown, non-Markdown, directory, missing file, symlink alias canonical dedupe와 legacy session 이관·invalid reference 부분 복구를 검증한다.

### Task B2 — AI 전역 cross-root runtime tabs와 선택적 재시작 복원

- [x] `src/types/library.ts`: 실행 중 AI open-document list와 settings 복원에 `DocsDocumentRef = { root: string; path: string }`, `DocsTabSession = { documents: readonly DocsDocumentRef[]; active: DocsDocumentRef | null }`를 사용한다. 파일 내용·buffer·cursor·scroll은 포함하지 않는다.
- [x] `src/lib/settings.ts`: legacy `tabSessions.docs`의 상대경로 목록을 당시 `docsRoot`와 결합해 AI 전역 세션으로 이관한다. 별도 root allowlist 검증은 하지 않는다.
- [x] `src/hooks/useLibraryWorkspace.ts`: 기존 hook 안에서 AI 문서만 root-qualified runtime으로 일반화한다. 각 open document가 자신의 `root`를 보유하고 document map/save promise/snippet key/native read·save는 composite identity와 document root를 사용한다. AI browse root 변경은 snapshot·visible folder/snippet scope만 교체하고 open document/buffer/mode를 유지한다. Human root 변경은 기존 root-local reset 계약을 유지한다. 새 hook 파일은 만들지 않는다.
- [x] `src/App.tsx`/workspace 경계: AI tab bar는 모든 root의 열린 문서를 유지한다. docs 공간의 component key에서 root를 제거해 root switch로 hook을 remount하지 않는다(Human은 기존 root별 remount 유지). 다른 root의 tab 선택은 현재 문서 저장 barrier 성공 후 대상 `{ root, path }`에서 browse root와 parent folder를 파생하고 해당 root snapshot을 성공적으로 scan한 뒤 active를 교체한다. scan/open 실패도 기존 root·active tab·buffer를 유지한다.
- [x] `src/components/TabBar.tsx`: AI `active`/key/select/close는 `{ root, path }` identity를 사용한다. 모든 AI tab은 첫 줄 Title, 둘째 줄 muted gray `root basename / relative parent folder`의 2-line label을 표시한다. root 바로 아래 문서는 둘째 줄에 root basename만 표시한다. filename은 Title에서만 표시한다. tab bar는 한 header row를 유지하되 AI tab 내부 높이와 leading/trailing edge control을 함께 맞춘다. 화면 label은 ellipsis, tooltip과 accessible name은 canonical root + 전체 상대경로를 제공한다. Human tab은 기존 단일-line 계약을 유지한다.
- [x] 테스트: 서로 다른 root의 동명 상대경로 공존, Open File source 추가/dedupe, cross-root tab 선택과 browse root 전환, target scan/open 실패 시 상태 불변, active tab close 시 right-then-left fallback과 마지막 tab의 연결 path 제거, 재시작 후 tab/path projection 복원을 검증한다.

### Task B3 — 파생 DocsRootSwitcher

- [x] `src/components/DocsRootSwitcher.tsx` — open document 순서와 1:1인 square 문자 shortcut을 표시한다. 각 문자는 canonical 전체 파일 path를 tooltip·accessible name으로 제공하고 선택하면 연결 문서를 활성화한다. row의 `+`는 기존 Open File handler를 호출하며 add/remove/context menu/unavailable 관리 상태는 없다.
- [x] `src/lib/i18n.ts`: 관리형 문구를 제거하고 Open File·source folder 전환 문구로 교체한다.
- [x] `src/index.css`: switcher 스타일.

### Task B4 — App 통합 (Open File·자동 파생·전환)

- [x] `src/App.tsx`: AI welcome과 workspace open control에서 Markdown file picker를 연다. `resolveDocumentSource` 성공 후 해당 root snapshot을 scan하고 문서를 열며, 새로운 root는 open document projection에 자동 등장한다.
- [x] `LibraryApp` 세션 배선: `openDocuments`에서 path projection을 만들고 switcher와 tab bar가 같은 `selectTab(identity)`를 호출하게 한다. 선택된 문서의 root/parent가 base path와 2nd pane을 결정한다.
- [x] AI 문서 목록의 `+`는 새 문서 생성이 아니라 Open File이다. 수동 root add/remove handler와 confirmation을 삭제한다. Human create/rename/move/delete 계약은 유지한다.
- [x] `src/App.test.tsx`: Open File → source path 자동 등장, A/B 선택 → 연결된 file 활성화/base path 이동, no add/remove UI, tab close → 연결 path 제거, 빈 tab session → AI welcome을 검증한다.

### Task B5 — 문서 계약 갱신 (Phase B 델타)

- [x] `docs/specs/intent-memo.md`: AI root를 열린 file source projection으로 서술하고 수동 등록·제거 계약을 삭제한다.
- [x] `CLAUDE.md`: Product/UI Contract에 AI Open File, 자동 root 파생, 마지막 tab close 생명주기를 반영한다.
- [x] `DESIGN.md`: ActiveRoot를 관리 UI가 아닌 열린 source folder switcher로 정의하고 add/remove affordance 금지를 명시한다. AI 2-line tab anatomy은 유지한다.

### Task B6 — Phase B 검증

- [x] `pnpm test`(105) → `pnpm check` → `pnpm build` → cargo fmt/clippy/tests(10) → updater-disabled production Tauri `.app`/`.dmg` build → `git diff --check` 통과. 표준 updater artifact signing은 외부 `TAURI_SIGNING_PRIVATE_KEY`가 없어 코드 검증과 분리했다.
- [x] Tauri smoke: AI Open File로 A/a.md와 B/b.md를 열어 A/B가 자동 표시되고, A/B 선택 시 연결 file/source path 이동, B tab close 시 B path 제거, 재시작 후 A 복원, 수동 folder 추가/제거 UI 부재를 실제 앱에서 확인했다.
- [x] visual/keyboard smoke: logical 1024×768/216px pane, 긴 source path ellipsis, A/B active state, AI `Title`/muted path 2줄, onboarding en·ko/Light·Two-Tone을 fresh captures로 확인했고 keyboard/overflow 계약은 component tests로 검증했다. 독립 visual integrity·CJK review 모두 PASS.

### Task C — AI path shortcut UI 보정

- [x] component/App 회귀 테스트를 먼저 실패시켜 `A | B | C` 문자-전체 path 연결, 선택 전환, row `+` Open File을 고정했다.
- [x] 기존 disclosure를 30px square shortcut row로 교체하고 active/hover/focus-visible token 상태를 구현했다.
- [x] targeted/full frontend 검증과 실제 Tauri focus·A/B·Open File picker smoke. Biome 50 files, Vite/TypeScript build, Vitest 107 tests, cargo fmt/clippy/Rust 10 tests, updater-disabled `.app`/`.dmg` build가 통과했다.
- [x] fresh capture 4개(초기, keyboard focus, B 전환, native Open File picker)에 대한 독립 visual integrity·CJK review 2종 PASS.

### Task D — AI current folder row + dropdown

- [x] Human과 동일 anatomy의 current folder row를 active open file의 canonical parent/path에서 파생한다.
- [x] dropdown을 shortcut 아래에 열어 문자·folder명·전체 file path·active check를 표시하고 A/B/C shortcut을 계속 노출한다.
- [x] dropdown row와 shortcut이 동일한 document/source/list/tab/content 전환을 실행하도록 회귀 테스트한다.
- [x] 전체 자동 검증, 실제 Tauri interaction smoke, fresh visual integrity·CJK review 2종 PASS. Biome 50 files, TypeScript/Vite production build, Vitest 13 files·109 tests, cargo fmt, clippy `-D warnings`, Rust 10 tests, updater-disabled production `.app`/`.dmg`, `git diff --check`가 통과했다. 실제 Tauri에서 closed/open dropdown, B dropdown 선택, A keyboard shortcut, native `AI 문서 열기` picker를 확인했고 독립 visual integrity·CJK review가 모두 PASS했다.

### Task E — Human/AI 공통 2단 Source Card

- [x] `SpaceSwitcher.test.tsx`와 `DocsRootSwitcher.test.tsx`를 먼저 실패시켜 고정 2행 anatomy, Human `Tasteful Intent Library` / folder path, AI shortcut / active path 순서를 고정했다. targeted test 2건이 `.source-card` 부재로 의도대로 실패했다.
- [x] `SpaceSwitcher.tsx`, `DocsRootSwitcher.tsx`, `index.css`를 공통 Source Card geometry로 맞추고 dropdown을 카드 아래 overlay로 유지했다.
- [x] `CLAUDE.md`, `docs/specs/intent-memo.md`의 Human/AI source control 계약을 갱신했다.
- [x] targeted/full 자동 검증, 실제 Tauri Human↔AI 전환 위치 smoke, fresh visual integrity·CJK review 2종 PASS. Biome 50 files, TypeScript/Vite production build, Vitest 13 files·110 tests, updater-disabled production `.app`/`.dmg`가 통과했다. `/tmp/intent-memo-source-card-human-current.png`, `/tmp/intent-memo-source-card-ai-current.png`, `/tmp/intent-memo-source-card-ai-open-current.png`에서 Source Card·`폴더` header·tree 시작 위치 고정과 dropdown overlay를 확인했고 독립 CJK·visual fact-check가 PASS했다.

## 리스크·엣지 케이스

- wizard 중간 종료: 언어·테마만 저장된 채 재시작 → `libraryRoot`가 비어 있어 3단계 wizard에 재진입한다.
- 기존 사용자(root 저장됨)는 wizard를 보지 않는다 — 회귀 없음.
- 저장된 settings에 `documentSort`/AI tab session 누락·invalid → 해당 필드/항목만 fallback한다.
- 같은 폴더가 Human root이면서 AI Open File source가 되는 것은 막지 않는다. AI는 view mode/read-only 표면을 유지한다.
- AI active tab이 있으면 2nd pane 위치는 `{ root, parent(path) }`에서 파생한다. 별도 selected folder 저장값이 active document 위치와 경쟁하지 않는다.
- 현재 hook은 root 변경 effect에서 open document map을 비우고 `LibraryApp` key도 root를 포함하므로, key만 변경하거나 hook만 변경하는 부분 수정은 금지한다. Phase B의 root-qualified document identity와 reset 정책을 함께 적용한다.
- settings load는 현재 일부 schema 실패 시 전체 default로 돌아갈 수 있으므로, migration 전에 필드별 복구를 먼저 고정한다. 손상된 AI session이 유효한 Human root·theme·language를 초기화해서는 안 된다.
- AI root는 별도 제거 transaction이 없다. 마지막 tab close가 runtime/session reference와 root projection을 동시에 제거하며 실제 파일은 건드리지 않는다.
- OS picker file과 복원 session은 canonical identity를 사용한다. 사라진 file reference는 복원 시 개별 제외되고 별도 stale root를 남기지 않는다.

## 완료 근거

- 자동: Biome 50 files, TypeScript/Vite production build, Vitest 13 files·109 tests, cargo fmt, clippy `-D warnings`, Rust 10 tests, updater-disabled Tauri production `.app`/`.dmg`, `git diff --check`.
- 실제 앱: `/tmp/intent-memo-dropdown-closed.png`, `/tmp/intent-memo-dropdown-open.png`, `/tmp/intent-memo-dropdown-b-selected.png`, `/tmp/intent-memo-dropdown-a-shortcut.png`, `/tmp/intent-memo-dropdown-open-file.png`.
- 시각 검증: fresh 2048×1536 capture 5개와 `/tmp/intent-memo-dropdown-open-diff.json`, `/tmp/intent-memo-dropdown-b-diff.json`에 대한 독립 visual integrity·CJK review 2종 PASS.
- 사용자 상태: QA 전후 settings SHA-256 `1a53805b2c84f07435829cd266062ed3905ee23b611be2dc9a93f92f427183bc` 일치, 임시 app process 종료.
- Source Card 최종 QA: 현재 checkout에서 updater-disabled production bundle을 다시 만든 뒤 2048×1536 Human/AI closed/AI open capture 3개를 생성했다. Apple Vision OCR은 AI closed crop의 `폴더`를 실제 glyph bbox로 인식했고, 독립 CJK reviewer와 확대 visual fact-check가 고정 vertical anchor·dropdown overlay·CJK 렌더링을 PASS했다.
- Source Card QA 사용자 상태: production QA process만 종료하고 사용자 settings를 byte-for-byte SHA-256 `c70f2ff994b610a4df966cc4c80b21e0e915563fba4bd5e3e5c6075b9c9f6781`로 복원했다. 기존 개발 process는 변경하지 않았다.
