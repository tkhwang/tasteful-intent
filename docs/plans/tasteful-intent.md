# Plan: Tasteful Intent 리네이밍 + 설정(테마) 도입

작성일: 2026-08-08
상태: 완료
브랜치: `feat/update-0808`
관련: 제품 스펙 `docs/specs/intent-memo.md` · `DESIGN.md` · `CLAUDE.md` · `distribution/homebrew/tasteful-intent.rb`

## 확정된 결정

| 결정 | 요지 | 확정일 |
|---|---|---|
| 앱 이름 | **Tasteful Intent** (Tasteful Intent Memo·Intent Memo 대신) | 2026-08-08 사용자 결정 |
| 한글 병기 | **취향 담은 의도** ("취향적 의도" 대신) — 표기: `Tasteful Intent · 취향 담은 의도` | 2026-08-08 사용자 결정 |
| 제품 핵심 loop | **나의 의도와 취향 정리 → AI에 전달 → AI가 그 의도와 취향에 따라 대신 생성 → 결과 확인** | 2026-08-08 사용자 정의 |
| Welcome mark | `IM` initials를 제거하고 text hierarchy만 사용 | 2026-08-08 사용자 HTML 확인 |
| Welcome headline | **`내 생각과 만들고 싶은 것, 원하는 스타일을 먼저 적어보세요.`** | 2026-08-08 사용자 결정 |
| Welcome body | **`나의 의도와 취향을 AI에 전하면, AI는 그에 맞는 결과를 만들어 줍니다. 모든 결과의 출발점인 의도와 취향을 이곳에 기록하고 관리하세요.`** | 2026-08-08 사용자 결정 |
| 설정 UI | **Settings navigation 중앙 modal** + Appearance의 **2×2 theme tiles** (Light·Two-Tone·Dark·System) + 별도 Language section | 2026-08-08 사용자 HTML 비교 확인·후속 A 선택 |
| 설정 컴포넌트 위치 | `src/components/settings/SettingsDialog.tsx`에 feature folder로 배치 | 2026-08-08 사용자 결정 |
| 설정 hotkey | **추가하지 않음** — 기존 `⌘1`·`⌘2` pane 단축키만 유지하고 Settings는 visible button으로 연다 | 2026-08-08 사용자 결정 |
| 설정 진입점 | **navigation sidebar fallback** — 3-pane은 folder pane 하단, 2-pane은 document-list pane 하단, content-only는 숨김 | 2026-08-08 사용자 결정 |
| Markdown 위치 control | **compact clickable path** — folder icon + 현재 경로 + `ChevronRight`. 전체 row 클릭으로 active space의 Markdown folder picker를 연다 | 2026-08-08 사용자 후속 결정 |
| 설정 언어 | 왼쪽 navigation에 **Language를 별도 항목**으로 추가. **English가 기본값**, `한국어` 선택 가능, 선택 즉시 전체 UI에 적용·저장 | 2026-08-08 사용자 HTML 비교 A 선택 |
| Two-Tone theme | 사용자 표시 이름은 **Two-Tone**으로 변경. 저장용 theme key `charcoal`은 기존 설정 호환을 위해 유지 | 2026-08-08 사용자 결정 |
| 번역 catalog | 새 dependency 없이 **`src/lib/i18n.ts`** 한 파일에서 typed English·한국어 catalog와 React context를 관리 | 2026-08-08 사용자 결정 |
| 글꼴 설정 적용 범위 | **글쓰기 영역만 적용** — Markdown 편집기·문서 보기·큰 빈 화면 문구. 사이드바·버튼·경로·Settings 등 조작 UI는 고정 Sans 유지 | 2026-08-08 사용자 결정 A |
| 글꼴 source | **IBM Plex Sans KR·Hahmlet을 앱에 번들** — UI와 Sans writing은 IBM Plex Sans KR, Serif writing은 Hahmlet, fixed-width 영역은 system mono 유지 | 2026-08-23 사용자 후속 결정 |
| 글꼴 preset | **Sans-serif·Serif 두 개만 제공**, clean settings 기본값은 Sans-serif. Tasteful preset은 제거 | 2026-08-08 사용자 후속 결정 |

이름 근거: 제품의 핵심은 사용자가 먼저 자신의 의도와 취향을 정리하고, 이를 AI에 전달해 AI가 그 의도와 취향에 따라 대신 생성하게 한 뒤 결과를 확인하는 loop다. 이름이 의도(intent)+취향(taste)라는 제품 논지를 직접 실어 나르고 검색에서 유일하다. 영어 native에게 "tasteful"이 "품위 있는"으로 먼저 읽힐 수 있는 중의성은 인지하고 수용했다.

---

## Part 1 — Tasteful Intent 리네이밍

### 이름 체계

| 층위 | 현재 | 변경 후 | 비고 |
|---|---|---|---|
| Display name | `Intent Memo` | `Tasteful Intent` | UI·titlebar·문서 |
| 한글 병기 | `의도 메모` | `취향 담은 의도` | welcome eyebrow 등 |
| productName / .app | `IntentMemo` / `IntentMemo.app` | `TastefulIntent` / `TastefulIntent.app` | Gate R2 |
| kebab (배포) | `intent-memo` | `tasteful-intent` | Gate R3 |
| bundle identifier | `app.tkbetter.intentmemo` | **유지** | Gate R1, 아래 참조 |
| 내부 space 키 | `intent` / `docs` | **유지** | 스펙 계약 |
| Rust crate/lib | `intent-memo` / `intent_memo_lib` | **유지** | 외부 비노출 |

### 변경 지점 전수 조사 (2026-08-08 grep 기준)

Display 층 (안전, 전부 변경):

- `src/App.tsx:77` — titlebar 제품명
- `src/App.tsx:207` — "Intent Memo를 여는 중입니다" → "Tasteful Intent를 여는 중입니다"
- `src/App.tsx:223` — welcome-mark `IM` 요소 제거 (Gate R6)
- `src/App.tsx:224` — eyebrow `Intent Memo · 의도 메모` → `Tasteful Intent · 취향 담은 의도`
- `src/App.tsx:231` — welcome 본문 "Intent Memo는 그 원본을…"
- `src/main.tsx:8` — root element 에러 문구
- `src/components/PrimitiveShowcase.tsx:43` — "Intent Memo design system"
- `index.html:7` — `<title>`
- `src-tauri/tauri.conf.json:18` — window `title`
- `README.md`·`README.ko.md` — 제품 소개, 설치 cask, release URL과 배포 설명
- `assets/readme/hero-en.svg`·`assets/readme/hero-ko.svg` — hero title·제품명 text
- `src-tauri/capabilities/default.json:4` — capability description
- `src-tauri/gen/schemas/capabilities.json` — capability description의 tracked generated output
- `CLAUDE.md` — titlebar 계약 문장 등 제품명 표기
- `DESIGN.md` — 문서 제목, §1 Atmosphere, §4 Grid, WindowTitleBar 항목의 `Intent Memo` 표기
- `docs/specs/intent-memo.md` — 제품명 표기 문장 (파일 경로는 유지)

배포·번들 층 (Gate 결정 후 변경):

- `src-tauri/tauri.conf.json:3` — `productName`
- `src-tauri/tauri.conf.json:51` — updater endpoint의 GitHub repo URL
- `distribution/homebrew/intent-memo.rb` — cask 이름·`name`·`app`·URL
- `.github/workflows/ci.yml` — cask syntax path, `productName` assertion, legacy basename grep, unsigned bundle smoke의 `.app`·DMG 경로
- `.github/workflows/build-macos.yml` — GitHub Release 표시명
- `.github/workflows/build-macos-mas.yml` — MAS `.app` 경로·`.pkg` basename·artifact 이름. Rust 실행 파일 제외 조건의 `intent-memo`는 crate/binary 불변에 따라 유지
- `.github/workflows/homebrew-bump.yml` — DMG pattern·cask source/target 경로·commit scope
- `release-please-config.json` — `package-name`/`component` (유지 권장)
- `package.json:2` — `name` (내부, 변경 무해)

### 결정 Gate (리네이밍)

- [x] **R1. bundle identifier 유지** — `app.tkbetter.intentmemo` 그대로 둔다. 변경 시 macOS가 별개 앱으로 취급해 app data dir 경로가 바뀌고, tauri-plugin-store의 `settings.json`(libraryRoot·docsRoot·theme·탭 세션)이 유실되며 updater 연속성이 끊긴다. Apple 관례상 제품명 변경에도 bundle id는 유지한다.
- [x] **R2. productName** — `TastefulIntent`로 변경 (R3 확정에 결합: cask의 `app` stanza와 DMG/updater artifact 파일명이 productName에서 나오므로 한 세트다). `.app`·DMG 파일명이 바뀐다.
- [x] **R3. Homebrew cask** — **`tasteful-intent`로 clean cutover 확정** (2026-08-08 사용자 확인: 기존 유저 없음 → 마이그레이션 장치 불필요). personal tap(`tkhwang/homebrew-tap`)은 심사 절차가 없어 재등록은 파일 커밋 하나다. 구현 범위:
  - `distribution/homebrew/intent-memo.rb` → `tasteful-intent.rb` (token·`name "Tasteful Intent"`·`app "TastefulIntent.app"`·URL의 repo 주소와 DMG 파일명 패턴).
  - `.github/workflows/homebrew-bump.yml`의 하드코딩 갱신: `IntentMemo_${VERSION}_*.dmg` 패턴(50-60행), `Casks/intent-memo.rb` 경로(73-109행).
  - tap repo에서 기존 `Casks/intent-memo.rb` 삭제(수동 커밋 1건, 사용자 수행). `tap_migrations.json`·deprecate 병행 유지는 하지 않는다.
  - 개발 머신에 설치된 기존 cask는 `brew uninstall intent-memo` 후 새 이름으로 재설치한다. bundle identifier 유지(R1) + `zap` 부재로 설정·데이터는 보존된다.
- [x] **R4. GitHub repo 이름** — **리네이밍 완료** (`tkhwang/intent-memo` → `tkhwang/tasteful-intent`). 2026-08-08 현재 `origin` fetch/push가 모두 `git@github.com-personal:tkhwang/tasteful-intent.git`을 가리킨다. 로컬 폴더명은 유지해도 무방하다. 코드의 updater·README·cask `url`·`homepage`는 새 주소로 갱신하고 tap repo(`tkhwang/homebrew-tap`) 이름은 유지한다.
- [x] **R5. release-please** — `package-name`/`component`는 `intent-memo` 유지. 변경 시 태그·CHANGELOG 연속성이 깨진다.
- [x] **R6. welcome-mark** — `IM` initials를 제거하고 eyebrow·headline·body copy의 text hierarchy만 유지한다. App icon 자체는 Brain·Bot·memo symbol 계약(DESIGN.md AppIcon)이라 이름 변경과 무관, 재작업 없음.
- [x] **R7. welcome headline** — `내 생각과 만들고 싶은 것, 원하는 스타일을 먼저 적어보세요.`로 확정한다. 추상적인 `의도와 취향`을 사용자가 실제로 적을 내용으로 풀어 쓰고, AI보다 사람이 먼저 기록한다는 순서를 유지한다.
- [x] **R8. welcome body copy** — `나의 의도와 취향을 AI에 전하면, AI는 그에 맞는 결과를 만들어 줍니다. 모든 결과의 출발점인 의도와 취향을 이곳에 기록하고 관리하세요.`로 확정한다. 앱이 자동으로 AI를 호출한다고 표현하지 않고, 수동 handoff 이후 결과 생성과 source 기록 관리의 의미를 설명한다.

### 명시적 비변경

`identifier`, 내부 space 키(`intent`/`docs`), Cargo crate·lib 이름, MAS workflow의 Rust 실행 파일명 조건(`intent-memo`), `library.rs`의 temp 파일 prefix(`.intent-memo-*.tmp`), `docs/specs/intent-memo.md` 파일 경로, `public/intent-memo-icon.png` 자산 파일명 — 전부 외부 비노출이며 변경 시 위험 대비 이득이 없다. 과거 사실을 기록한 `CHANGELOG.md`와 완료된 과거 plan은 일괄 치환하지 않는다.

### 구현 단계

- [x] **Step R0 — 계약·소개 문서 델타**: `CLAUDE.md`·`DESIGN.md`·`docs/specs/intent-memo.md`의 현재 제품명 계약과 `README.md`·`README.ko.md`의 소개·설치·release URL·배포 설명을 갱신한다. spec 파일 경로는 유지하고, 핵심 설명은 확정된 사람 기록 → AI 전달 → 결과 확인 loop에 맞춘다.
- [x] **Step R1 — display 문자열과 welcome copy**: `App.tsx`(제품명 문자열 4곳 + welcome-mark 제거 + 확정된 headline/body copy), `main.tsx`, `PrimitiveShowcase.tsx`, `index.html`, `assets/readme/hero-en.svg`, `assets/readme/hero-ko.svg`를 갱신한다.
- [x] **Step R2 — Tauri 설정**: `src-tauri/tauri.conf.json`의 window `title`·`productName`·updater endpoint와 `src-tauri/capabilities/default.json`의 description을 갱신한다. `identifier`는 불변이며 Tauri 명령으로 `src-tauri/gen/schemas/capabilities.json`을 재생성해 tracked output도 일치시킨다.
- [x] **Step R3 — 배포·CI cutover**: cask 파일을 `distribution/homebrew/tasteful-intent.rb`로 rename하고 `.github/workflows/homebrew-bump.yml`의 DMG/cask 경로를 함께 바꾼다. `.github/workflows/ci.yml`, `build-macos.yml`, `build-macos-mas.yml`의 display·bundle·artifact hardcoding을 `Tasteful Intent`/`TastefulIntent`로 갱신한다. `release-please-config.json`과 Rust binary 이름은 유지한다.
- [x] **Step R4 — 정적·web 검증**: 변경된 titlebar·welcome·Settings 기대값을 포함한 `pnpm test`, `pnpm check`, `pnpm build`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`를 통과시킨다. 모든 workflow YAML parse, `ruby -c distribution/homebrew/tasteful-intent.rb`, `productName === "TastefulIntent"`, 새 updater/release/cask 경로와 legacy public basename 부재도 assertion으로 확인한다.
- [x] **Step R5 — native artifact·수동 QA**: `pnpm tauri build --target aarch64-apple-darwin --config '{"bundle":{"createUpdaterArtifacts":false}}'`로 unsigned local bundle을 만들고 `TastefulIntent.app`과 `TastefulIntent_${VERSION}_aarch64.dmg`를 실제 확인한다. 이어 실제 `.app`에서 titlebar·welcome copy·Settings 2×2 tile·즉시 theme 적용·3-pane/2-pane 진입점·content-only 숨김을 직접 확인한다. 릴리스 시에는 signed universal DMG와 MAS `.pkg` basename을 workflow artifact로 재확인한다.

---

## Part 2 — 설정(테마) 도입

HTML 비교안 확인 결과 **Settings navigation + 2×2 theme tiles**로 확정했다. 후속 HTML A 선택으로 중앙 modal의 왼쪽 navigation은 `Appearance`와 `Language`를 제공한다. Appearance에서는 Light·Two-Tone·Dark·System을 2×2 tile radio group으로 선택하고, Language에서는 English 기본·한국어를 radio row로 선택한다. 기존 theme 적용·저장 경로는 재사용하며 Two-Tone의 내부 key는 `charcoal`을 유지한다.

- [x] **S1 — `src/components/settings/SettingsDialog.tsx`**: settings feature folder를 만들고 `SettingsDialog`를 배치한다. `dialog-backdrop` + `name-dialog settings-dialog` 조합(MoveDialog focus-trap 패턴), 왼쪽 settings navigation과 오른쪽 content, 2×2 theme radio tile을 사용한다. 후속 변경으로 Appearance·Language section과 English·한국어 radio row를 추가하고 Charcoal 사용자 표시는 Two-Tone으로 바꿨다. `닫기`·Esc를 지원하고 열릴 때 현재 선택 항목에 focus한다. 단위 테스트는 같은 folder의 `src/components/settings/SettingsDialog.test.tsx`에 두고, barrel `index.ts`는 만들지 않으며 `App.tsx`에서 직접 import한다.
- [x] **S2 — `App.tsx` 진입점**: 기존 theme-picker(select)를 제거하고 Lucide `Settings` icon + `설정` visible button을 navigation sidebar 하단에 둔다. 3-pane에서는 folder pane, folder pane이 숨겨진 2-pane에서는 Human/AI switcher와 동일하게 document-list pane으로 이동해 정확히 하나만 렌더링한다. content-only에서는 숨기고 pane control로 navigation을 복원한다. `settingsOpen` state를 분리하고 닫을 때 opener focus를 복원하며 Settings 전용 keyboard shortcut은 추가하지 않는다.
- [x] **S3 — CSS**: `.theme-picker` 제거 → `.settings-button`·`.settings-dialog`·settings navigation·2×2 theme tile styles. 기존 token과 4px spacing scale만 사용하고, tile preview는 실제 Light·Two-Tone·Dark surface token 조합을 축약해 보여준다. biome import 정렬 주의: `{ THEMES, type Theme }`.
- [x] **S4 — 테스트**: SettingsDialog 단위 테스트에서 2×2 tile radio semantics, 현재 theme focus, 즉시 선택, Esc, focus trap을 검증한다. App 통합 테스트에서 3-pane/folder pane과 2-pane/document-list pane에 설정 button이 정확히 하나 존재하고 content-only에는 없음을 검증한다. visible button으로 dialog 열기, Two-Tone tile 선택 → `data-theme="charcoal"`·`saveSettings`, 닫을 때 opener focus 복원을 확인하며 Settings hotkey 기대값은 만들지 않는다.
- [x] **S5 — 문서 델타**: CLAUDE.md UI Contract appearance 항목에 진입점 문구, DESIGN.md `SettingsDialog` primitive 항목.
- 저장 구조(`settings.json` `theme` 키)·적용 경로(`lib/theme.ts`)는 불변. 이 단계의 font 종류·크기 제외는 후속 F1–F8 결정으로 superseded되었다. 최종 v0.2는 Sans-serif·Serif writing font를 제공하고 font size·custom font만 제외한다.

S 검증: 2026-08-08 `SettingsDialog.test.tsx`·`App.test.tsx` 25 tests, `pnpm check`, `pnpm build`, `git diff --check` 통과. 실제 2×2 layout과 각 theme의 시각·interaction 확인은 최종 R5 gate에서 수행한다.

### 후속 설정 개선 결정

- [x] **L1 — Language navigation**: 왼쪽 navigation을 `Appearance`와 `Language` 두 항목으로 구성한다. `Language` 화면은 `English`와 `한국어` radio 선택을 제공하며 English가 clean settings의 기본값이다. 선택 즉시 전체 application chrome·dialog·action copy에 반영하고 `settings.json`에 저장해 재시작 후 복원한다. 문서 제목·Markdown 본문·사용자가 지정한 파일·폴더명은 번역하지 않는다.
- [x] **T1 — Charcoal 표시 이름**: 사용자에게는 `Two-Tone`으로 표시해 dark-sidebar/light-workspace의 두 가지 명암 구성을 설명한다. `Light · Two-Tone · Dark · System` 순서를 사용하고 persisted theme key `charcoal`은 기존 설정 호환을 위해 유지한다.
- [x] **P6 — Markdown 위치 trailing affordance**: Pencil을 Lucide `ChevronRight`로 교체한다. 왼쪽 Folder는 현재 값의 정체성을, 오른쪽 Chevron은 row click 뒤 folder picker라는 다음 단계가 있음을 나타낸다. accessible name·tooltip의 전체 경로와 `폴더 변경` 설명은 유지한다.
- [x] **L2 — 번역 catalog 위치**: `src/lib/i18n.ts`에 `Language`별 typed message catalog와 React context/hook을 둔다. 두 언어와 현재 UI 규모에서는 `src/i18n/` folder를 만들지 않고, catalog가 분리 필요 규모에 도달할 때만 후속 구조 변경을 검토한다.
- [x] **F1 — 글꼴 설정 적용 범위**: Settings에서 선택한 글꼴은 Markdown 편집기·Markdown 보기와 큰 빈 화면 문구에만 적용한다. navigation sidebar, 문서 목록, tab, titlebar, button, dialog, filesystem path를 포함한 조작 UI는 고정 Sans typography를 유지해 작은 글자의 가독성·정렬과 hit-area 밀도를 안정적으로 보존한다.
- [x] **F2 — 글꼴 source (2026-08-08, superseded)**: macOS 기본 서체만 사용한다. font asset, package dependency, font license bundle을 추가하지 않고 시스템 Sans/Serif와 Avenir Next·Apple SD Gothic Neo·AppleMyungjo 계열 조합으로 preset을 만든다.
- [x] **F2c — bundled Korean typography (2026-08-23)**: F2의 source 결정만 대체한다. 기존 Sans-serif·Serif 설정 key와 글쓰기/UI 적용 범위는 유지하면서 UI·Sans writing은 IBM Plex Sans KR, Serif writing은 Hahmlet을 사용한다. system font는 fallback, fixed-width 영역은 SFMono/Cascadia Code를 유지하고, 필요한 Korean·Latin WOFF2 weight와 OFL notice만 앱에 포함한다.
- [x] **F2a — preset 구성과 기본값**: `Sans-serif`와 `Serif` 두 preset만 제공하고 `Sans-serif`를 clean settings 기본값으로 삼는다. 제품 전용 `Tasteful`과 현재 코드 편집기 인상을 만든 Mono/Typewriter preset은 포함하지 않는다.
- [x] **F2b — Tasteful 제거**: 명조 한글과 HeadLineA Sans 후보를 포함한 Tasteful 조합 실험은 종료한다. 억지로 브랜드 전용 서체를 만들지 않고 제품 개성은 고정 UI typography·색상·layout에서 유지한다.
- [x] **F3 — Typography Settings HTML 확인**: Typography section에서 `Sans-serif`와 `Serif`를 동일 크기의 2-column radio box로 보여주고, 선택 결과를 바로 아래 한글·영문 live preview에 즉시 반영한다. 사용자가 통합 HTML A안을 확인했다.
- [x] **F4 — Language Settings HTML 확인**: 기존 English·한국어 가로 banner row를 동일 크기의 2-column radio box로 바꾸고, 선택 결과를 바로 아래 실제 Settings/New Intent 한글·영문 live preview에 즉시 반영한다. Typography와 동일한 선택 문법으로 사용자가 확인했다.

### Typography·Language 구현 단계

- [x] **F5 — RED: persistence·Settings·App 계약 테스트**
  - clean/legacy settings의 `writingFont: "sans"`, Serif round-trip, invalid font의 독립 fallback을 고정한다.
  - Settings의 Typography navigation, Sans-serif·Serif 2열 radio box, 선택 callback, Language 2열 box와 live preview를 고정한다.
  - App의 즉시 `data-writing-font` 반영과 저장 payload를 고정한다.
  - RED 증거: targeted 39 tests 중 기존 30개 통과, 새 9개가 `writingFont` schema/default, Typography navigation, shared card/live preview, root dataset 부재의 예상 원인으로 실패했다.
- [x] **F6 — GREEN: typed persistence와 writing surface 적용**
  - `WritingFont = "sans" | "serif"`를 설정 schema에 추가하고 Sans-serif를 기본값으로 저장·복원한다.
  - Markdown editor·view와 큰 빈 화면 문구만 CSS variable을 사용하고 application chrome은 기존 Sans를 유지한다.
- [x] **F7 — GREEN: Settings Typography·Language card UI**
  - Appearance와 Language 사이에 Typography navigation을 추가한다.
  - Typography와 Language가 같은 2-column 선택 card·selected indicator·하단 live preview anatomy를 공유하게 한다.
  - 선택은 즉시 적용하고 기존 Settings close/focus-trap/accessibility 계약을 유지한다.
- [x] **F8 — 문서·전체 검증·실제 Tauri QA**
  - `CLAUDE.md`, `DESIGN.md`, 제품 spec에 글꼴 범위·기본값과 Language card 계약을 반영한다.
  - targeted/full frontend test, Biome, build, Rust fmt/test/clippy, diff check, unsigned Tauri bundle을 통과시킨다.
  - 실제 앱에서 두 설정의 즉시 적용·재시작 복원과 글쓰기/UI 글꼴 범위 분리를 확인하고 QA 설정을 원복한다.
  - 검증 증거: frontend 12 files·81 tests, Biome, TypeScript/Vite build, Rust fmt·9 tests·clippy `-D warnings`, `git diff --check`, debug unsigned app bundle 통과. 격리 Tauri app에서 Sans-serif↔Serif와 English↔한국어 즉시 저장, `한국어 + Serif` 재시작 복원, Markdown editor/empty copy와 app chrome의 font scope 분리를 확인했다. 공식 no-excuse script는 project TypeScript 5.5에서 TypeScript 7 unstable API를 resolve할 수 없어 동일 금지 패턴의 repo-wide fallback audit로 대체했고 통과했다.

### 후속 구현 단계

- [x] **I1 — RED: persistence·Settings·App·icon 계약 테스트**
  - `src/lib/settings.test.ts`: 빈/legacy store는 `language: "en"`, `ko` round-trip, invalid language만 English fallback.
  - `src/lib/i18n.test.ts`: English·한국어 핵심 catalog와 parameterized accessible copy를 고정.
  - `src/components/settings/SettingsDialog.test.tsx`: Appearance/Language navigation, `Two-Tone`, English 기본 선택, 한국어 즉시 callback, panel별 focus trap.
  - `src/App.test.tsx`: English 기본 chrome, Settings에서 한국어 선택 직후 UI·`document.lang`·`saveSettings({ language: "ko" })`, 재렌더링된 한국어 Settings.
  - `src/components/SpaceSwitcher.test.tsx`: trailing `ChevronRight`가 있고 Pencil이 없음을 고정.
  - targeted test를 실행해 새 계약 부재로 실패하는 것을 확인한다.
- [x] **I2 — GREEN: typed language persistence와 catalog**
  - `src/types/library.ts`: `LANGUAGES = ["en", "ko"]`, `Language`, `LayoutSettings.language` 추가.
  - `src/lib/settings.ts`: Zod language boundary, English default, 독립 invalid fallback, load/save key 추가.
  - 새 `src/lib/i18n.ts`: dependency 없는 typed catalog, `I18nProvider`, `useI18n`; 사용자 문서·path 값은 그대로 interpolation한다.
  - settings/i18n targeted test를 통과시킨다.
- [x] **I3 — GREEN: Settings navigation·Two-Tone UI**
  - `src/components/settings/SettingsDialog.tsx`: `Monitor` Appearance와 `Languages` Language navigation, section state, 2개 language radio row, current section focus, 즉시 `onLanguageChange`; `charcoal` label만 `Two-Tone`으로 변경.
  - `src/index.css`: 기존 token/4px rhythm으로 language rows와 section navigation states를 추가하고 modal 크기·2×2 tile anatomy는 유지.
  - SettingsDialog targeted test와 `pnpm check`를 통과시킨다.
- [x] **I4 — GREEN: application chrome 번역과 Chevron**
  - `src/App.tsx`, `src/components/{DocumentList,FolderTree,MoveDialog,NameDialog,SpaceSwitcher,TabBar}.tsx`: `useI18n` catalog로 application chrome·dialog·action·empty/error/accessibility copy를 전환하고 `document.documentElement.lang`을 동기화한다. 사용자 문서 제목·Markdown·filesystem 이름은 변경하지 않는다.
  - 후속 I4 GREEN 증거: targeted 39 tests, `tsc -b`, 변경 파일 Biome check 통과. 독립 컴포넌트는 English 기본 catalog를 사용하고 App integration은 저장된 언어를 즉시 적용한다.
  - `src/components/SpaceSwitcher.tsx`: trailing Pencil import/render를 `ChevronRight`로 교체한다.
  - App·component targeted tests를 통과시킨다.
- [x] **I5 — docs·전체 검증·실제 UI QA**
  - `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`에 English default/한국어, Language navigation, Two-Tone display-name/internal-key 분리, `Folder | path | ChevronRight` 계약을 반영한다.
  - `pnpm test`, `pnpm check`, `pnpm build`, Rust fmt/test/clippy, `git diff --check`, unsigned Tauri build를 통과시킨다.
  - 실제 `.app`에서 English 기본, 한국어 즉시 전환·재시작 복원, Settings 두 section, Two-Tone tile, Chevron과 OS folder picker를 확인하고 QA 설정을 원복한다.
  - 후속 I5 검증 증거: frontend 12 files·76 tests, Biome, TypeScript/Vite build, Rust fmt·9 tests·clippy `-D warnings`, `git diff --check`, unsigned `TastefulIntent.app`·DMG 생성 통과. 실제 release app에서 English↔한국어 즉시 적용·저장, 새 process의 언어 복원, Two-Tone→`charcoal`, `Folder | path | ChevronRight`, native folder-picker sheet, editor accessible label 전환을 확인했고 사용자 `settings.json`을 원본 SHA-256과 byte-for-byte 일치하게 복원했다.

---

## Part 3 — 현재 Markdown 위치 강조

HTML 비교안 B인 **compact path + trailing affordance**를 유지하되, Pencil은 `ChevronRight`로 교체한다. 기존 ActiveRoot의 위치와 click 동작은 유지하고 `Folder | path | ChevronRight` anatomy로 “현재 Markdown folder”와 “다음 선택 단계”를 전달한다. 별도 `Markdown 위치` label이나 card는 추가하지 않는다.

- [x] **P1 — `src/components/SpaceSwitcher.tsx`**: sidebar variant의 `.root-row`에 Lucide folder icon, 기존 연속 경로(parent ellipsis + leaf bold), `ChevronRight`를 순서대로 배치한다. row 전체가 기존 `onRootChange`를 호출하며 icon은 `aria-hidden`으로 두고 중첩 button은 만들지 않는다.
- [x] **P2 — 접근성 문구**: button의 accessible name과 tooltip을 `현재 Markdown 위치: {전체 경로}. 클릭하여 폴더 변경` 의미로 명시한다. 화면에는 별도 설명 label을 늘리지 않되 keyboard focus만으로도 변경 action이 드러나야 한다.
- [x] **P3 — CSS**: `.root-row`를 `icon | minmax(0, 1fr) path | icon` 구조로 정렬한다. rest 상태의 낮은 대비 surface는 유지하고 Folder/Chevron과 최종 folder leaf는 `--space-text`, 부모 경로는 `--sidebar-muted`를 사용한다. hover·focus-visible에서 border/background 대비를 높이되 card shadow나 새 raw color token은 추가하지 않는다.
- [x] **P4 — 테스트**: `SpaceSwitcher.test.tsx`에서 deep path의 parent ellipsis/leaf 분리, 전체 경로를 포함한 accessible name·title, click 시 `onRootChange` 1회 호출을 검증한다. `App.test.tsx`는 3-pane folder pane에 control이 한 개 있고 2-pane·content-only에는 노출되지 않는 기존 ActiveRoot ownership을 고정한다.
- [x] **P5 — 문서·수동 QA**: `DESIGN.md`의 `SpaceSwitcher`·`ActiveRoot`와 `CLAUDE.md` UI Contract에 compact icon/path/Chevron anatomy와 click-to-change 의미를 반영한다. Light·Two-Tone·Dark에서 긴 경로 ellipsis, leaf 식별, hover, keyboard focus, OS folder picker 진입을 실제 Tauri 화면에서 확인한다.

P 검증: 2026-08-08 `SpaceSwitcher.test.tsx`·`App.test.tsx` 26 tests, `pnpm check`, `pnpm build`, `git diff --check` 통과. 실제 Tauri 시각·interaction 확인은 최종 R5 gate에서 수행한다.

## 저장소 근거로 닫은 사항

- repo rename은 `origin` fetch/push URL로 완료 상태를 확인했으므로 추가 사용자 작업을 구현 선행조건으로 두지 않는다.
- Settings hotkey를 추가하지 않으므로 기존 `⌘1`·`⌘2`와 modal shortcut 충돌 정책은 새로 만들 필요가 없다. modal이 열린 동안 backdrop·focus trap·Esc만 dialog가 소유한다.
- Markdown 위치 control은 기존 `SpaceSwitcher`의 ActiveRoot와 `handleRootChange`를 강화하는 변경이므로 새 persistence/API/file을 만들지 않는다. 기존 계약대로 3-pane folder pane만 root를 소유하며 2-pane·content-only에는 중복 노출하지 않는다.
- 리네이밍은 UI 문자열만의 변경이 아니다. CI·Devid/MAS build·Homebrew bump·updater·README·hero SVG의 hardcoding을 같은 cutover 단위로 취급한다.
- `.app`/DMG basename은 release까지 미루지 않고 unsigned local Tauri build에서 먼저 검증할 수 있다. 서명·notarization·MAS 제출 자체만 release 후속 gate로 남긴다.

## 최종 검증 증거

- 2026-08-08 `pnpm test`: 11 files, 70 tests 통과. jsdom의 CodeMirror `getClientRects` stderr는 기존 환경 noise이며 exit code는 0이다.
- `pnpm check`, `pnpm build`, `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check`, `cargo test --manifest-path src-tauri/Cargo.toml --all-features`(9 tests), `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`, `git diff --check` 통과.
- Homebrew cask Ruby syntax, GitHub Actions YAML 5개 parse, productName·identifier·updater·cask·legacy public basename 정적 assertions 통과.
- unsigned build에서 `src-tauri/target/aarch64-apple-darwin/release/bundle/macos/TastefulIntent.app`과 `src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/TastefulIntent_1.0.1_aarch64.dmg` 생성 확인.
- 실제 `TastefulIntent.app` 수동 QA: welcome/titlebar와 확정 copy, welcome mark 제거, 현재 Markdown 위치 강조·긴 경로, OS folder picker 진입, Light·Two-Tone·Dark 2×2 theme tile과 즉시 저장, 3-pane·2-pane Settings fallback, content-only 숨김을 확인했다. QA용 설정 변경 뒤 기존 사용자 `settings.json`을 byte-for-byte 복원했다.
- README 영문·한글 hero SVG를 Quick Look으로 재렌더링해 제품명·motif·설명문 겹침과 clipping이 없음을 확인했다.

후속 I1 RED 증거: 2026-08-08 persistence·Settings·App·SpaceSwitcher targeted run에서 73 tests 중 기존 61개는 통과하고 새 계약 12개가 `language` 부재, `Appearance`/`Language` navigation 부재, `Two-Tone` 부재, trailing Chevron 부재의 예상 원인으로 실패했다.

## 진행 순서

**P(현재 Markdown 위치) → S(설정) → R0~R3(리네이밍·배포 cutover) → R4~R5(전체 검증)** 순으로 진행한다. P는 기존 ActiveRoot의 anatomy·accessibility만 먼저 고정하고, S는 기존 theme 적용·저장 경로를 보존하면서 설정 UI를 교체한다. R은 display·bundle·CI·배포 hardcoding을 한 번에 전환한다. 각 기능 slice에서 targeted test를 먼저 돌리고, 최종 통합 상태에서 전체 test/check/build·Rust·unsigned bundle·real Tauri smoke를 한 번 수행한다. 커밋은 사용자가 수행한다.
