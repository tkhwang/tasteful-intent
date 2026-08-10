# Human/AI View/Edit Cycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Human과 AI 문서 모두 content header 우측의 동일한 mode control로 `Edit → View → Split(Edit | View) → Edit`를 순환하고, AI에서 편집한 외부 Markdown도 기존 안전 저장 경계로 저장되게 한다.

**Architecture:** `LibraryApp`이 이미 active document의 mode와 root-aware autosave를 공통으로 사용하므로 새 상태나 API를 만들지 않는다. `src/App.tsx`의 Human-only render guard만 제거해 기존 mode control을 AI에도 노출하고, AI는 View 기본·Human은 Edit 기본을 유지한다. AI에서 허용하는 변경은 열린 파일의 본문 편집뿐이며 folder/file create·rename·move·Trash와 folder registration UI는 계속 제공하지 않는다.

**Tech Stack:** React 19 + TypeScript, CodeMirror 6, Vitest + Testing Library(jsdom), Tauri v2/Rust filesystem commands, Biome.

---

## Requirements Summary

- Human과 AI 모두 tab row 맨 오른쪽에 42px mode control을 표시한다.
- 두 공간 모두 기존 순서 `Edit → View → Split(Edit | View) → Edit`와 기존 icon/accessible label을 재사용한다.
- Human 새 문서는 Edit, AI Open File 문서는 View로 시작한다 (`src/App.tsx:393-429`).
- AI Edit/Split에서 변경한 본문은 현재 `{ root, path }`로 `save_document`에 전달한다 (`src/hooks/useLibraryWorkspace.ts:384-466`).
- AI의 mode는 현재 열린 tab의 runtime state로만 유지한다. 현재 `DocsTabSession`은 reference만 저장하므로 앱 재시작 후 AI 문서는 다시 View로 열린다; settings schema는 확장하지 않는다.
- AI의 Open File, 전역 `{ root, path }` tab/session, Source Card, 문서 목록 탐색은 그대로 유지한다.
- AI folder/file create·rename·move·Trash와 mutation context menu는 계속 노출하지 않는다.
- 새 dependency, 새 i18n key, 새 Tauri command, settings migration을 추가하지 않는다.
- 과거 계획 문서는 의사결정 이력으로 유지하고 다시 쓰지 않는다. canonical 계약인 `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`만 갱신한다.
- Git commit/push는 하지 않는다. 사용자가 검증된 변경을 직접 commit한다.

## Acceptance Criteria

1. Human Edit 문서에서 우측 `PencilLine` control이 보이고 클릭하면 View로 바뀐다.
2. AI View 문서에서 우측 `Eye` control이 보이고 클릭하면 Split으로 바뀌며, 다음 클릭은 Edit로 바뀐다.
3. AI Edit/Split의 CodeMirror 변경은 active document의 canonical `{ root, path }`와 open-time mtime을 사용해 저장된다.
4. AI save 상태가 dirty/saving/error일 때 Human과 동일한 transient save status가 mode control 바로 앞에 표시된다.
5. 같은 파일명이 서로 다른 AI root에 있어도 변경 내용은 active root의 파일에만 저장된다.
6. external mtime conflict가 발생하면 기존 `external-change` 경계가 원본을 덮어쓰지 않고 error 상태를 유지한다.
7. AI 문서 목록의 rename/move/Trash와 folder create/add/remove UI는 계속 존재하지 않는다.
8. AI tab/session persistence shape는 `{ documents: {root,path}[], active }`로 유지되고 mode 필드는 추가되지 않는다.
9. 3-pane, 2-pane, content-only 모두 tab row 우측 끝에 현재 문서의 mode control을 정확히 하나 표시한다.
10. targeted tests, 전체 Vitest, Biome, TypeScript/Vite build, Rust fmt/clippy/tests, Tauri production build, 실제 Tauri smoke test가 통과한다.

## File Structure

- Modify: `src/App.tsx` — active space와 무관하게 기존 mode control/save status를 렌더링한다.
- Modify: `src/App.test.tsx` — AI mode cycle, trailing 위치, save status, structural read-only 경계를 검증한다.
- Modify: `src/hooks/useLibraryWorkspace.test.tsx` — AI cross-root 편집이 active `{root,path}`에 저장되는 기존 회귀를 mode까지 명시한다.
- Modify: `src/lib/settings.test.ts` — mode 변경 뒤 저장되는 raw `tabSessions.docs`가 `{ documents: { root, path }[], active }`만 포함하고 settings store에 mode를 남기지 않는지 검증한다.
- Modify: `CLAUDE.md` — AI를 content-editable/structure-read-only로 정의한다.
- Modify: `DESIGN.md` — ModeCycleButton을 Human/AI 공통 control로 정의한다.
- Modify: `docs/specs/intent-memo.md` — 제품 범위, workspace, 편집, 장기 경계, smoke 기준을 새 계약에 맞춘다.

---

### Task 1: AI mode cycle UI regression lock

**Files:**
- Modify: `src/App.test.tsx:463-666`
- Modify: `src/App.test.tsx:668-799`

- [ ] **Step 1: AI structural-action 테스트를 mode 계약과 분리**

기존 `keeps the AI workspace read-only` 테스트를 아래처럼 structural mutation만 검증하도록 이름과 마지막 assertion을 수정한다. mode control 부재 assertion은 제거한다.

```tsx
it("keeps AI structural mutation actions unavailable", async () => {
  testState.workspace.visibleDocuments = [
    { path: "a.md", parent: "", title: "First", updatedMs: 1 },
  ];
  render(<App />);
  const documentRow = await screen.findByRole("option", { name: /First/ });

  fireEvent.contextMenu(documentRow);

  expect(screen.queryByRole("menuitem", { name: "이름 변경…" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "이동…" })).toBeNull();
  expect(
    screen.queryByRole("menuitem", { name: "휴지통으로 이동" }),
  ).toBeNull();
});
```

- [ ] **Step 2: AI mode control의 실패 테스트 작성**

같은 `AI multi-root workspace` describe에 다음 테스트를 추가한다.

```tsx
it("cycles an AI document from View using the far-right mode control", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  const modeButton = await screen.findByRole("button", {
    name: "현재 View · 클릭하면 Edit | View 분할",
  });
  const actions = container.querySelector(".tab-bar-actions");

  expect(actions?.lastElementChild).toBe(modeButton);
  expect(modeButton.getAttribute("data-mode")).toBe("view");

  await user.click(modeButton);

  expect(testState.workspace.setMode).toHaveBeenCalledWith("split");
});
```

- [ ] **Step 3: AI save-status의 실패 테스트 작성**

```tsx
it("shows AI save status immediately before the mode control", async () => {
  testState.workspace.saveStatus = "saving";
  const { container } = render(<App />);

  const modeButton = await screen.findByRole("button", {
    name: "현재 View · 클릭하면 Edit | View 분할",
  });
  const actions = container.querySelector(".tab-bar-actions");
  const status = actions?.querySelector(".save-status");

  expect(status?.textContent).toBe("저장 중");
  expect(status?.nextElementSibling).toBe(modeButton);
});
```

- [ ] **Step 4: 실패 상태 확인**

Run:

```bash
pnpm vitest run src/App.test.tsx
```

Expected: 신규 AI mode-control 테스트 2개가 `Unable to find role="button" and name "현재 View · 클릭하면 Edit | View 분할"`로 FAIL하고, structural-action 테스트와 기존 Human mode 테스트는 PASS한다.

---

### Task 2: Human/AI 공통 mode control 구현

**Files:**
- Modify: `src/App.tsx:939-961`
- Test: `src/App.test.tsx`
- Test: `src/lib/settings.test.ts`

- [ ] **Step 1: Human-only render guard 제거**

`TabBar`의 `trailingActions` 조건에서 `activeSpace === "intent"`만 제거한다. fragment 내부와 icon, label, `workspace.setMode()` 호출은 변경하지 않는다.

```tsx
trailingActions={
  modeControl ? (
    <>
      {workspace.saveStatus === "dirty" ||
      workspace.saveStatus === "saving" ||
      workspace.saveStatus === "error" ? (
        <span className={`save-status ${workspace.saveStatus}`}>
          {saveLabel(workspace.saveStatus, messages)}
        </span>
      ) : null}
      <button
        aria-label={modeControl.label}
        className="icon-button header-cycle-button mode-cycle-button"
        data-mode={workspace.activeDocument?.mode}
        onClick={() => workspace.setMode(modeControl.next)}
        title={modeControl.label}
        type="button"
      >
        <ModeIcon aria-hidden="true" size={16} />
      </button>
    </>
  ) : null
}
```

- [ ] **Step 2: targeted App 테스트 통과 확인**

Run:

```bash
pnpm vitest run src/App.test.tsx
```

Expected: Human/AI mode control, save status, no-navigation-label, pane layout 테스트를 포함한 `src/App.test.tsx` 전체 PASS.

- [ ] **Step 3: AI mode 기본값 유지 확인**

`src/App.tsx:396`은 다음 상태를 유지해야 한다. AI를 Edit 기본으로 바꾸지 않는다.

```tsx
const defaultMode = settings.activeSpace === "docs" ? "view" : "edit";
```

- [ ] **Step 4: AI mode 비저장 settings regression 추가**

`src/lib/settings.test.ts`의 plugin-store fake에 mode가 섞인 post-mode-change session candidate를 저장하고, `loadSettings()` 결과가 아니라 raw store write를 검사한다. read parser가 mode를 제거해 버려도 write-side 회귀를 놓치지 않도록 `storedValues.get("tabSessions")`를 exact equality로 고정한다.

```ts
it("persists only AI document references after a runtime mode change", async () => {
  const docsSessionAfterModeChange = {
    documents: [{ root: "/docs/a", path: "a.md", mode: "edit" as const }],
    active: { root: "/docs/a", path: "a.md", mode: "edit" as const },
  };

  await saveSettings({
    libraryRoot: "/memo/intent",
    docsRoot: "/docs/a",
    activeSpace: "docs",
    folderPaneOpen: true,
    listPaneOpen: true,
    documentDensity: "full",
    documentSort: "updated",
    theme: "light",
    language: "en",
    writingFont: "sans",
    tabSessions: {
      intent: { paths: [], activePath: null },
      docs: docsSessionAfterModeChange,
    },
  });

  expect(storedValues.get("tabSessions")).toEqual({
    intent: { paths: [], activePath: null },
    docs: {
      documents: [{ root: "/docs/a", path: "a.md" }],
      active: { root: "/docs/a", path: "a.md" },
    },
  });
  expect([...storedValues.keys()]).not.toContain("mode");
});
```

Run:

```bash
pnpm vitest run src/lib/settings.test.ts
```

Expected: raw `tabSessions.docs`는 정확히 `{ documents: [{ root, path }], active }`이며 nested/top-level mode가 settings store에 남지 않는다.

- [ ] **Step 5: settings/session production schema 무변경 확인**

Run:

```bash
git diff -- src/lib/settings.ts src/types/library.ts
```

Expected: 출력 없음. AI mode는 runtime open-document state이며 `DocsTabSession`에 저장하지 않는다.

---

### Task 3: AI cross-root edit/save characterization 강화

**Files:**
- Modify: `src/hooks/useLibraryWorkspace.test.tsx:173-218`
- Production change: 없음

- [ ] **Step 1: 기존 cross-root 저장 테스트에 mode 계약 추가**

기존 `keeps same-path documents and save identities independent across AI roots` 테스트 이름을 아래처럼 변경하고, `/docs/b/shared.md`를 편집하기 직전에 mode를 Edit로 바꾼다.

```tsx
it("edits and saves same-path AI documents using the active root identity", async () => {
  // 기존 arrange/open assertions 유지

  act(() => {
    result.current.setMode("edit");
    result.current.updateBody("changed in B");
  });
  await act(async () => {
    await result.current.activateDocument({
      root: "/docs/a",
      path: "shared.md",
    });
  });

  expect(native.saveDocument).toHaveBeenCalledWith(
    "/docs/b",
    "shared.md",
    expect.stringContaining("changed in B"),
    1,
  );
  expect(
    result.current.openDocuments.find(
      ({ root, path }) => root === "/docs/b" && path === "shared.md",
    ),
  ).toMatchObject({ mode: "edit", saveStatus: "saved" });
  expect(result.current.activeReference).toEqual({
    root: "/docs/a",
    path: "shared.md",
  });
});
```

기존 arrange 부분과 같은-path/root independence assertion은 삭제하지 않는다.

- [ ] **Step 2: hook regression 통과 확인**

Run:

```bash
pnpm vitest run src/hooks/useLibraryWorkspace.test.tsx
```

Expected: `/docs/b/shared.md`만 저장되고 `/docs/a/shared.md`가 active fallback으로 유지되는 테스트를 포함해 전체 PASS.

- [ ] **Step 3: Rust 저장 경계가 그대로 사용되는지 정적 확인**

`src-tauri/src/library.rs:131-141`의 `save_document`가 canonical root 내부의 Markdown file, expected mtime, atomic save를 계속 요구하는지 확인한다. 새 command나 AI 전용 우회 저장 경로를 만들지 않는다.

---

### Task 4: canonical product/design contract 갱신

**Files:**
- Modify: `CLAUDE.md:5,41`
- Modify: `DESIGN.md:126-131`
- Modify: `docs/specs/intent-memo.md:13-24,38-62,87-113,167-175,185-193`

- [ ] **Step 1: CLAUDE.md의 AI 권한 문구 교체**

Product Contract 첫 문단의 `AI is read-only` 문장을 다음 계약으로 교체한다.

```text
AI Open File documents are path-scoped external Markdown sources: their content is editable through the shared Edit, View, and Split modes and the existing atomic-save/mtime-conflict boundary, while AI folder/file creation, rename, move, Trash, and folder registration remain unavailable.
```

UI Contract의 mode 문장은 다음처럼 고친다.

```text
Human opens in Edit and AI opens in View; both support Edit → View → Split(Edit | View), while AI structural file/folder management remains unavailable.
```

- [ ] **Step 2: DESIGN.md ModeCycleButton 계약 갱신**

`DESIGN.md:128`을 다음으로 교체한다. 나머지 icon, 순서, accessible-label 계약은 유지한다.

```text
- Human과 AI active document 모두에 표시한다. Human은 Edit, AI는 View로 처음 열리며 두 공간 모두 같은 mode cycle을 사용한다. AI는 content 편집만 허용하고 mutation context menu나 folder/file 관리 action은 제공하지 않는다.
```

- [ ] **Step 3: 제품 spec의 권한 모델을 일관되게 갱신**

`docs/specs/intent-memo.md`에서 아래 canonical 의미를 반영한다.

```text
- Human은 Edit, AI는 View로 새 문서를 열며 두 공간 모두 `Edit → View → Split(Edit | View)`를 순환한다.
- AI `{ root, path }` open-document session은 열린 파일의 본문 편집과 autosave를 허용하지만 folder/file create·rename·move·Trash와 folder registration은 소유하지 않는다.
- AI mode는 열린 tab runtime state이고 restart persistence 대상은 reference 목록과 active reference뿐이다.
- AI content 저장도 canonical root/path, atomic same-directory temporary file, open-time mtime conflict 검사를 사용한다.
```

반드시 수정할 기존 stale 계약:

- 성공 조건의 `AI는 read-only다`, `AI는 View로만 읽는다` (`:18,20`)
- 포함 범위의 `AI용 read-only` (`:43`)
- Workspace의 `read-only라 mode/mutation control을 제공하지 않는다` (`:93`)
- 문서 편집의 `AI tab은 read-only View다` (`:107`)
- 장기 경계의 `OS Open File ... read-only` (`:173`)
- 검증 기준의 `AI read-only/no folder management` (`:191`)

유지할 계약:

- AI mutation context menu 부재 (`:100`)
- tab/path close가 디스크 파일을 변경하지 않음 (`:110`)
- 향후 자동 생성·자동 갱신되는 별도 AI 관리 계층은 read-only (`:76`)

- [ ] **Step 4: stale canonical wording 검색**

Run:

```bash
rg -n 'AI is read-only|AI remains read-only|AI는 read-only|AI는 View로만|AI tab은 read-only|read-only라 mode' CLAUDE.md DESIGN.md docs/specs/intent-memo.md
```

Expected: 결과 없음. 미래의 자동 관리 계층을 설명하는 `read-only` 문구는 이 검색 대상이 아니며 유지한다.

- [ ] **Step 5: historical plan 보존 확인**

Run:

```bash
git diff -- docs/plans | sed -n '1,240p'
```

Expected: 이 신규 plan 외의 기존 plan 내용은 변경되지 않는다.

---

### Task 5: 전체 자동 검증

**Files:**
- Verification only

- [ ] **Step 1: frontend targeted tests**

```bash
pnpm vitest run src/App.test.tsx src/hooks/useLibraryWorkspace.test.tsx
```

Expected: 두 파일 전체 PASS. CodeMirror jsdom의 기존 `getClientRects` stderr가 있어도 exit code와 Vitest verdict가 PASS인지 분리해 기록한다.

- [ ] **Step 2: frontend full gates**

```bash
pnpm test
pnpm check
pnpm build
```

Expected: 모든 명령 exit 0.

- [ ] **Step 3: Rust safety gates**

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: format diff 없음, clippy warning 0, Rust tests 전체 PASS.

- [ ] **Step 4: production bundle**

```bash
pnpm tauri:build
```

Expected: exit 0이며 macOS app/DMG artifact 생성. signing/notarization 자격증명 작업은 수행하지 않는다.

- [ ] **Step 5: diff hygiene**

```bash
git diff --check
git status --short
```

Expected: whitespace error 없음. 변경 파일은 `src/App.tsx`, `src/App.test.tsx`, `src/hooks/useLibraryWorkspace.test.tsx`, `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md`와 이 plan뿐이며 debug artifact는 없다.

---

### Task 6: 실제 Tauri Human/AI smoke 및 시각 검증

**Files:**
- Runtime verification only

- [ ] **Step 1: 격리된 AI 편집 fixture 생성**

실제 프로젝트 문서를 수정하지 않도록 임시 폴더를 사용한다.

```bash
qa_root="$(mktemp -d /tmp/intent-memo-mode-cycle.XXXXXX)"
cat > "$qa_root/ai-edit-cycle.md" <<'EOF'
---
created: 2026-08-10T00:00:00.000Z
updated: 2026-08-10T00:00:00.000Z
---
AI mode cycle QA
EOF
printf '%s\n' "$qa_root/ai-edit-cycle.md"
```

생성된 경로는 smoke 기록에 남기고 종료 후 삭제한다.

- [ ] **Step 2: fresh Tauri dev 실행**

```bash
pnpm tauri:dev
```

Expected: `Tasteful Intent` 창이 열리고 port 1420/Vite 또는 Tauri runtime error가 없다.

- [ ] **Step 3: AI View → Split → Edit와 저장 검증**

1. AI space에서 Step 1의 `ai-edit-cycle.md`를 Open File한다.
2. two-line AI tab과 tab row 우측의 `Eye` mode control이 동시에 보이는지 확인한다.
3. `Eye` 클릭 후 Split이 표시되고 우측 icon이 `Columns2`로 바뀌는지 확인한다.
4. `Columns2` 클릭 후 Edit만 표시되고 우측 icon이 `PencilLine`으로 바뀌는지 확인한다.
5. 본문 끝에 `\nEdited from AI space`를 입력하고 dirty/saving 표시가 나타난 뒤 사라지는지 확인한다.
6. 터미널에서 다음을 실행한다.

```bash
rg -n 'Edited from AI space' "$qa_root/ai-edit-cycle.md"
```

Expected: marker 1건. frontmatter `updated`가 바뀌고 파일은 같은 경로에 남는다.

- [ ] **Step 4: AI structural mutation 제한 확인**

AI 문서/폴더 목록에서 context menu를 열어 rename, move, Trash가 없고 create-folder action도 없는지 확인한다. Source Card `+`는 계속 Open File만 실행해야 한다.

- [ ] **Step 5: Human mode cycle 회귀 확인**

Human space로 전환해 기존 문서를 열고 `PencilLine → Eye → Columns2 → PencilLine` 순서와 Edit/View/Split surface를 확인한다. Human의 create/rename/move/Trash는 기존대로 유지한다.

- [ ] **Step 6: 동일 framing 시각 증거 캡처**

AI two-line tabs, 좌측 `PanelLeft`, 우측 mode control이 한 화면에 보이도록 1024×768 창에서 캡처한다.

```bash
screencapture -x /tmp/intent-memo-human-ai-mode-cycle.png
```

Expected: 사용자 제보 화면의 우측 빈 영역에 42px mode control이 보이고 tab/titlebar가 잘리거나 겹치지 않는다. 캡처는 QA artifact이며 repo에 추가하지 않는다.

- [ ] **Step 7: fixture와 runtime artifact 정리**

Tauri dev를 종료한 뒤 Step 1의 임시 폴더와 `/tmp/intent-memo-human-ai-mode-cycle.png`를 제거한다. 사용자 문서와 settings를 임의로 삭제하거나 초기화하지 않는다.

- [ ] **Step 8: 최종 변경 파일 보고**

보고 항목:

- 구현 파일과 테스트 파일
- canonical 계약 변경 파일
- red → green targeted test 결과
- 전체 frontend/Rust/Tauri build 결과
- Human/AI 실제 mode cycle과 AI autosave 관찰 결과
- AI structural mutation UI가 계속 없는지
- 남은 risk: mode가 tab session에 저장되지 않아 AI는 restart 후 View로 시작함(의도된 계약)

제안 commit message(사용자가 직접 수행): `feat(editor): enable mode cycle for human and ai documents`.
