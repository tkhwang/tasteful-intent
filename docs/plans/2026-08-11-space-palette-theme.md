# Space Palette (Human/AI 색 조합) Theme Design

## Goal

테마가 surface 색만 결정하는 현재 구조에서, Human(`intent`)/AI(`docs`) 역할 색 조합도 사용자가 프리셋 중에서 선택하게 한다. 사용자는 Settings의 Appearance와 온보딩 테마 단계에서 색 조합을 고르고, 선택은 테마와 독립적으로 모든 space 색 소비처에 즉시 적용된다.

## Scope

- 프리셋 4개를 제공한다: `classic`(기본) · `terracotta-teal` · `plum-moss` · `mono-duo`.
- SettingsDialog Appearance 섹션의 테마 타일 아래, 그리고 온보딩 내부 `step === 1`(표시상 Step 2 of 3, 테마 단계)의 테마 타일 아래에 동일한 2×2 radio 타일 그룹을 추가한다. 온보딩 단계 수와 번호는 바꾸지 않는다.
- 선택은 `settings.json`의 `spacePalette` 키로 영속하고 html의 `data-space-palette` attribute로 적용한다.
- `--space-accent` / `--space-tint` / `--space-text`의 41개 소비처와 기존 6개 역할 블록의 선택자는 수정하지 않는다.
- 실행 중 추가된 문서 surface 요구로, root-contained 상대 이미지 표시와 활성 Markdown 문서의 PDF export를 함께 제공한다.

## Decisions

- **프리셋은 총 4개, custom color picker 없음** (사용자 확정). `amber-indigo`(Human `#96691f`/`#d4a95c`, AI `#5c63aa`/`#8f96cf`)는 대비 검증까지 완료된 예비안으로 남긴다 — 추가 시 CSS 블록 1개 + enum 1항목 + 라벨 2개.
- **팔레트 선택은 Settings와 온보딩 양쪽에 모두 제공**한다 (사용자 확정). 온보딩에서는 내부 `step === 1`의 기존 테마 그룹 바로 아래에 노출하며, 선택적 개인화이더라도 첫 사용 흐름에서 Human/AI 역할 색을 함께 확인하고 고를 수 있어야 한다.
- **Human=따뜻한 톤 / AI=차가운 톤 원칙을 전 조합에서 유지**한다 (`docs/specs/2026-08-06-human-ai-characterisation-design.md`의 red/blue 대비 계승). `mono-duo`도 웜 그레이 vs 쿨 그레이로 온도 대비를 유지한다.
- **기본값은 `classic`(현재 레드/블루 그대로)**: 기존 사용자는 아무 변화도 보지 않는다. 키 부재 시 `parseOrDefault`가 classic으로 폴백하므로 마이그레이션 코드는 없다.
- **아키텍처는 raw 토큰 레이어 + var() 매핑 2단 구조**: 팔레트당 raw 토큰 12개(`--human-accent/tint/text` + `-dark` 변형, `--ai-*` 동일)를 `[data-space-palette]` 블록으로 정의하고, 기존 6개 역할 블록은 값만 `var()` 참조로 바꾼다. hex는 팔레트 블록에만 존재한다.
- **classic 블록은 `:root, [data-space-palette="classic"]` 이중 선택자**로 선언한다. JS 적용 전 기본값과 비활성 팔레트 프리뷰 정확성을 동시에 해결한다. `:root`와 attribute 선택자는 동일 specificity(0,1,0)이므로 비-classic 블록이 반드시 뒤에 와야 하며, 이 제약은 CSS 주석으로 고정한다.
- **프리뷰 타일은 raw 토큰을 직접 소비**한다: 프리뷰 span에 `data-space-palette={option}`을 붙여 팔레트 블록이 로컬로 매치되게 한다. `--space-accent`를 쓰면 조상에서 이미 해석된 활성 팔레트 색을 상속받으므로 불가. 테마 프리뷰처럼 hex를 3중 복제하지 않는다.
- **온보딩 Skip은 내부 `step === 1`에서 `classic`을 명시 적용**해 단계 기본값을 결정적으로 만든다 (repo 계약으로 확정). 현재 언어·테마 단계도 Skip 시 각 기본값 `en`·`charcoal`을 다시 적용하므로 같은 lifecycle을 따른다. 사전선택 effect에는 추가하지 않는다(`classic`이 clean settings 기본값이라 불필요한 저장만 발생).
- **tint는 명시적 rgb 값 유지, `color-mix()` 미사용** (기존 스타일 일치, WebView 지원 리스크 제거). 알파는 기존 관례(light: Human 10% / AI 12%, dark: 공통 16%).
- **라벨**: fieldset 제목 en `Human & AI colors` / ko `Human·AI 색상`. 팔레트명 en `Classic` · `Terracotta & Teal` · `Plum & Moss` · `Mono Duo`, ko `클래식` · `테라코타 & 틸` · `플럼 & 모스` · `모노 듀오`.
- **PDF export는 현재 활성 Markdown 문서의 렌더 결과를 대상으로 하고 시스템 인쇄 대화상자의 Save as PDF를 사용**한다 (추가 dependency 없이 현재 Tauri/WebView surface를 유지하는 repo 제약으로 확정). Human/AI 양쪽 space에서 제공하며, Edit 모드에서도 화면 mode를 바꾸지 않고 print-only 렌더 view를 출력한다. 앱 chrome·editor·sidebar·tab은 인쇄 대상에서 제외하고 상대 로컬 이미지도 포함한다.
- **로컬 Markdown 이미지는 현재 문서의 `{ root, path }` 경계 안에서만 native byte read 후 Blob URL로 표시**한다. 외부 URL은 기존 브라우저 로딩을 유지하고, root 밖 traversal·symlink·비이미지 파일은 거부한다. 광범위한 asset protocol scope는 열지 않는다.

## Palette 정의

다크 표면 `#20242c`(charcoal 사이드바 `#272c34` 포함) 기준 WCAG AA를 만족하도록 설계된 값. classic은 현재 값 그대로다. 계획 검토 시 WCAG 상대휘도 공식으로 재계산한 최저 대비는 light accent/white `4.52:1`, light text/white `6.07:1`, dark accent/charcoal sidebar `4.61:1`, dark text/dark content `7.99:1`로 모두 일반 텍스트 AA 기준 이상이다.

| Palette | Role | accent (light) | tint (light) | text (light) | accent (dark) | tint (dark) | text (dark) |
|---|---|---|---|---|---|---|---|
| classic | Human | `#b5524a` | `rgb(181 82 74 / 10%)` | `#9e4038` | `#d87a68` | `rgb(216 122 104 / 16%)` | `#f0b4a8` |
| classic | AI | `#5878a0` | `rgb(88 120 160 / 12%)` | `#41618c` | `#7e9ec4` | `rgb(126 158 196 / 16%)` | `#b8cde4` |
| terracotta-teal | Human | `#aa6038` | `rgb(170 96 56 / 10%)` | `#92502a` | `#dc9068` | `rgb(220 144 104 / 16%)` | `#f2c4a4` |
| terracotta-teal | AI | `#3a807e` | `rgb(58 128 126 / 12%)` | `#2c6b69` | `#66aaa6` | `rgb(102 170 166 / 16%)` | `#a6d4cf` |
| plum-moss | Human | `#8e5a9e` | `rgb(142 90 158 / 10%)` | `#71427f` | `#bc8ec8` | `rgb(188 142 200 / 16%)` | `#e0c2ea` |
| plum-moss | AI | `#6b7d46` | `rgb(107 125 70 / 12%)` | `#52632f` | `#9aad6e` | `rgb(154 173 110 / 16%)` | `#ccdaa4` |
| mono-duo | Human | `#857262` | `rgb(133 114 98 / 10%)` | `#6d5c4e` | `#b4a394` | `rgb(180 163 148 / 16%)` | `#d9ccc0` |
| mono-duo | AI | `#687888` | `rgb(104 120 136 / 12%)` | `#556474` | `#9cadbe` | `rgb(156 173 190 / 16%)` | `#c9d5e1` |

## Design

- `src/types/library.ts` — `THEMES` 옆에 `SPACE_PALETTES` const + `SpacePalette` 타입, `LayoutSettings`에 `readonly spacePalette: SpacePalette;`.
- `src/lib/settings.ts` — `spacePaletteSchema = z.enum(SPACE_PALETTES)`, `settingsSchema`·`defaultSettings(classic)`·`loadSettings`(12번째 키 + `parseOrDefault`)·`saveSettings` 확장. 기존 필드 추가 패턴 그대로.
- `src/lib/theme.ts` — `applySpacePalette(palette)`: `document.documentElement.dataset.spacePalette = palette;` (`dataset.theme`·`dataset.writingFont`와 동일 패턴).
- `src/index.css` — `:root`의 space 리터럴 3개를 `var(--human-*)` 매핑으로 교체하고 `:root` 블록 직후에 팔레트 raw 토큰 4블록 삽입(classic 먼저). 나머지 5개 역할 블록(`[data-space="docs"]`, charcoal `.folder-pane` 2블록, dark 2블록)은 선택자 불변, 값만 light/`-dark` 계열 `var()`로 교체. 팔레트 타일 프리뷰 CSS 추가: `.palette-tile-preview`(2분할, 44px) + `.palette-swatch-human/ai`, `[data-theme="dark"]`에서는 `-dark` raw 사용. 타일 chrome(`.theme-tile*`)은 전부 재사용. Settings는 dialog 높이를 `min(500px, calc(100vh - 40px))`로 제한하고 `.settings-content`만 세로 스크롤한다. 온보딩은 `.onboarding-screen`을 세로 스크롤 컨테이너로 만들고 `justify-content: flex-start` + `.onboarding-card { margin-block: auto; }` 패턴으로 카드가 들어갈 때는 중앙 정렬, 넘칠 때는 카드의 위·아래와 navigation을 모두 접근 가능하게 한다. navigation은 별도 sticky 처리하지 않는다.
- `src/lib/i18n.ts` — `settings.spacePalette` 문자열 + `spacePaletteLabels: Record<SpacePalette, string>`(en/ko, `satisfies`로 누락 방지).
- `src/components/settings/SettingsDialog.tsx` — `spacePalette`/`onSpacePaletteChange` props, Appearance의 테마 fieldset 아래 팔레트 fieldset(`name="space-palette"`). Appearance 진입 시 기존처럼 선택된 theme radio를 첫 포커스로 유지하고, 두 번째 checked radio인 palette는 정상 Tab 순서에 포함한다.
- `src/components/OnboardingScreen.tsx` — 동일 props, 내부 `step === 1` 테마 fieldset 아래 팔레트 fieldset(`name="onboarding-space-palette"`, legend는 visible), Skip 핸들러에 `if (step === 1) onSpacePaletteChange("classic");`.
- `src/App.tsx` — `applySpacePalette` effect(writingFont effect 옆), OnboardingScreen·SettingsDialog 마운트에 props 배선(`onSettingsChange` / `updateLayout({ spacePalette })`).
- `docs/specs/intent-memo.md` — clean settings와 persisted settings 목록에 `spacePalette: "classic"` 및 전역 팔레트 복원 계약을 추가하고, 온보딩 표시상 Step 2와 Settings Appearance 양쪽 선택 surface 및 실제 앱 검증 기준을 동기화한다.

## Boundaries

- `--space-*` 소비처 41곳, 6개 역할 블록의 선택자, charcoal의 `.folder-pane` 스코프(다크 사이드바에만 dark 변형)는 구조적으로 불변이다.
- `system` 테마와는 완전 직교한다: dark 변형은 `data-theme` 선택자로만 활성화되고 `resolveTheme`는 손대지 않는다.
- 온보딩 단계 수(`TOTAL_STEPS = 3`)와 표시 번호 계약은 변하지 않는다. 팔레트는 내부 `step === 1`, 즉 표시상 Step 2 of 3에 들어간다.
- 새 source/spec/test 파일이나 디렉토리는 만들지 않는다. 기존 타입·settings·theme·component·test·canonical 문서에만 확장한다.
- `docs/specs/2026-08-06-human-ai-characterisation-design.md`는 수정하지 않는다(§6.1 값이 곧 classic).
- README hero SVG 등 정적 자산은 범위 외다.
- 비-classic 사용자의 JS 적용 전 순간적 classic 표시는 기존 테마 FOUC와 동일한 성질로 수용한다.

## Verification

- settings: 전체 형태 assert에 `spacePalette` 반영, `"plum-moss"` 라운드트립, 잘못된 값(`"neon"`)은 해당 키만 classic 폴백, 첫 실행 시 classic.
- App: `document.documentElement.dataset.spacePalette` 런타임 적용(`it.each`), 온보딩 표시상 Step 2 팔레트 클릭 → `saveSettings`에 `spacePalette` 포함, Continue은 선택값 유지, Skip은 classic 복원.
- SettingsDialog: radio 8개, `group { name: "Human & AI colors" }` 존재, 팔레트 클릭 시 `onSpacePaletteChange`만 호출, Appearance 첫 포커스는 선택 theme 유지, Tab 순서에 선택 palette가 포함되고 닫기 버튼과 포커스 트랩이 유지됨.
- i18n: `spacePaletteLabels` en/ko assert.
- browser showcase(`pnpm dev`, `?showcase=1`): 팔레트 matrix를 Human/AI 쌍으로 확인하고, 팔레트 전환 시 스위처·선택 행·탭 밑줄·모드 컨트롤·에디터 마크가 함께 바뀌는지 확인한다. 4개 테마 × 4개 팔레트에서 light/dark 변형과 비활성 팔레트 프리뷰가 정확해야 한다.
- 실제 Tauri(`pnpm tauri:dev`): 온보딩 표시상 Step 2와 Settings Appearance 양쪽에서 선택·즉시 적용, Continue/Skip semantics, Settings 닫기·keyboard focus, 재시작 영속, 키 삭제 시 classic 기동을 확인한다. 창 높이를 줄여 Settings content와 온보딩 카드 상단부터 navigation까지 키보드·포인터·스크롤로 모두 접근 가능하고, 내용이 viewport 안에 들어올 때는 기존 중앙 정렬이 유지되는지 확인한다.
- 실제 Tauri 문서 surface: nested Markdown 상대 이미지가 표시되는지 확인하고, Human/AI 및 Edit/View에서 PDF export action이 시스템 인쇄 대화상자를 열며 저장한 PDF가 앱 chrome 없이 렌더 Markdown과 동일한 로컬 이미지를 포함하는지 PDF page render로 확인한다.

## Non-goals

- custom color picker, 팔레트별 개별 색 편집
- 역할별 독립 선택(Human만 또는 AI만 변경)
- 테마별로 다른 팔레트 저장(팔레트는 전역 1개)
- 기존 `--space-*` 토큰 이름 변경이나 소비처 리팩터링

## Implementation Plan

- [x] **Task 1: settings/타입/적용 경계**
  - `settings.test.ts`에 spacePalette 라운드트립·폴백·첫 실행 회귀를 RED로 추가하고 `App.test.tsx`에 runtime `data-space-palette` 회귀를 RED로 추가한다.
  - `types/library.ts`, `lib/settings.ts`, `lib/theme.ts`, `App.tsx`(effect 배선)를 구현한다.
  - Targeted tests, Biome, build를 통과한다.
  - Evidence: `pnpm vitest run src/lib/settings.test.ts src/App.test.tsx` 70 tests, `pnpm check`, `pnpm build` 통과.

- [x] **Task 2: index.css 팔레트 레이어**
  - 팔레트 raw 토큰 4블록(classic 이중 선택자 + 순서 주석)을 삽입하고 6개 역할 블록을 `var()` 매핑으로 전환한다.
  - 팔레트 타일 프리뷰 CSS를 추가한다.
  - `?showcase=1`에서 4개 테마 × 4개 팔레트 조합을 시각 확인한다.
  - Evidence: `pnpm check`, `pnpm build` 통과. `/tmp/intent-memo-space-palette-{light,charcoal,dark,system}-v2.png`와 `/tmp/intent-memo-space-palette-charcoal-plum-moss.png`에서 theme surface, 4개 Human/AI pair, non-classic global 적용을 확인.

- [x] **Task 2.5: 문서 상대 이미지 + PDF export**
  - native root-contained image read와 Markdown Blob URL 경계를 테스트 우선 구현하고 실제 Tauri에서 원본 PNG 픽셀 표시를 확인한다.
  - 활성 문서 toolbar에 PDF export action을 추가하고 Edit 모드에서도 유지되는 print-only Markdown view 및 앱 chrome 제외 print stylesheet를 테스트 우선 구현한다.
  - 시스템 Save as PDF로 생성한 PDF를 렌더해 본문·상대 로컬 이미지 포함을 확인한다.
  - Evidence: App/i18n targeted 54 tests와 `cargo check` 통과. 실제 Tauri `/tmp/intent-memo-local-image-qa-pixels-2.png`에서 상대 PNG가 표시됐고, `/tmp/intent-memo-native-pdf-dialog-live-4.png`에서 native A4 preview, `/tmp/intent-memo-export-qa.pdf`와 page render에서 앱 chrome 없이 동일 이미지·본문 포함을 확인.

- [x] **Task 3: SettingsDialog·Onboarding UI + i18n**
  - `SettingsDialog.test.tsx`(radio 8개, 새 group, 콜백, 포커스 트랩)·`App.test.tsx`(온보딩 선택·Skip)·`i18n.test.ts`(라벨)를 RED로 추가한다.
  - `i18n.ts`, `SettingsDialog.tsx`, `OnboardingScreen.tsx`, `App.tsx`(props 배선)를 구현하고 `index.css`에 Settings content 및 온보딩의 overflow-safe 세로 레이아웃을 추가한다. Settings dialog는 viewport 최대 높이를 제한하고 우측 content만 세로 스크롤한다.
  - Targeted tests, Biome, build를 통과한다.
  - Evidence: Settings/App/i18n targeted 61 tests, `pnpm check`, `pnpm build` 통과. `/tmp/intent-memo-settings-palette-bottom-small-qa.png`와 `/tmp/intent-memo-onboarding-palette-scroll-fixed.png`에서 두 fieldset과 작은 창의 내부 스크롤·navigation 접근을 확인.

- [x] **Task 4: 문서 계약 동기화 + 전체 검증**
  - `CLAUDE.md`(UI Contract Appearance 문장), `DESIGN.md`(토큰 표·규칙·온보딩/설정 계약), `docs/specs/intent-memo.md`(clean/persisted settings·온보딩·검증 계약)를 갱신한다.
  - `pnpm test`, `pnpm check`, `pnpm build`, `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`, `cargo test --manifest-path src-tauri/Cargo.toml`, `pnpm tauri:build`를 통과한다.
  - browser showcase와 실제 Tauri에서 위 수동 checklist를 각각 확인하고 증거를 남긴다.
  - Evidence: `pnpm test` 153 tests, `pnpm check`, `pnpm build`, cargo fmt/clippy/test(14 tests), `git diff --check` 통과. 기본 `pnpm tauri:build`는 app·DMG 생성 후 updater signing private key 부재로 종료했으며, `pnpm exec tauri build --config '{"bundle":{"createUpdaterArtifacts":false}}'`로 동일 release app·DMG production build를 통과했다. browser showcase, 실제 Tauri local image·native print/PDF, Settings·onboarding small-viewport QA 증거를 확보했다.
