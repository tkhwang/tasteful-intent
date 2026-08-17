# AI Unified Folder Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the global AI `Browse | Pinned` mode split with one ordered folder-tab workspace where pinning is a nullable label property and every canonical root owns one restorable document session.

**Architecture:** Persist one versioned `docsRoots` list, one active `docsRoot`, and one root-indexed `tabSessions.docs` namespace. Keep only one mounted root buffer at runtime, preflight target roots before activation, retain unavailable roots and sessions, and render pinned and unpinned entries through one `DocsRootSwitcher` split-control surface.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Zod, Tauri Store/Dialog IPC, Rust `scan_docs_root`, Biome, Vite.

**Source design:** `docs/plans/2026-08-17-ai-unified-pin-tabs.md`

**Execution constraint:** Do not commit or push. The user owns Git operations.

---

## File responsibility map

- `CLAUDE.md`: repository product/architecture instructions; must describe the unified mode before product code changes.
- `DESIGN.md`: Source Card, tab/menu, focus, and unavailable-root interaction contract.
- `docs/specs/intent-memo.md`: product success criteria, persistence model, lifecycle, and safety contract.
- `src/types/library.ts`: final version-2 settings and unified AI root/session types.
- `src/lib/settingsParsing.ts`: version discrimination, legacy/current migration, normalization, and storage validation.
- `src/lib/settings.ts`: store reads, version-2 writes, and retired-key deletion.
- `src/hooks/useLibraryWorkspace.ts`: scanner injection for restore, refresh, and reload plus optional preflight snapshot handoff.
- `src/components/DocsRootSwitcher.tsx`: the sole unified pinned/unpinned Source Card owner.
- `src/components/PinnedRootsSwitcher.tsx`: remove after unified switcher coverage exists.
- `src/App.tsx`: root activation transaction, runtime availability/navigation maps, pin lifecycle, dialogs, and workspace composition.
- `src/lib/i18n.ts`: unified user-facing vocabulary and accessible action names.
- `src/index.css`: two-row Source Card, split controls, menus, unavailable state, and focus-visible styling.
- Existing adjacent `*.test.*` files: regression coverage; do not create a parallel test hierarchy.

## Task 1: Synchronize authoritative product contracts

**Files:**
- Modify: `CLAUDE.md:3-55`
- Modify: `DESIGN.md:102-127,180-212`
- Modify: `docs/specs/intent-memo.md:13-24,38-64,83-119,175-183`

- [x] **Step 1: Replace the two-mode product vocabulary**

Update all three authorities to state this current contract:

```text
AI has one ordered folder-tab workspace.
docsRoots entries use { root, label }, where label !== null means pinned.
Pinned entries are ordered before unpinned entries.
Pin/Unpin changes label, order, and close protection without changing root/session identity.
```

- [x] **Step 2: Replace first-entry and Source Card contracts**

Document one `Open AI folder` first-entry action, pinned shortcuts on row one, unpinned folder tabs on row two, split select/ellipsis controls, the exact keyboard/focus behavior from the source design, and the unified Document List header order `Refresh → Sort → Density → Open Folder`.

- [x] **Step 3: Replace persistence and lifecycle contracts**

Document `settingsSchemaVersion: 2`, `docsRoots`, `docsRoot`, `tabSessions.docs`, targeted unavailable-root Refresh, right-then-left close fallback, arbitrary canonical nested roots, and the single-runtime-buffer/save-barrier invariant.

- [x] **Step 4: Verify obsolete product language is gone from authorities**

Run:

```bash
rg -n 'Browse \| Pinned|일반 \| 고정|docsSourceMode|docsBrowseRoots|docsPinnedRoots|docsBrowseRoot|docsPinnedRoot|docsBrowse|docsPinned|may not overlap|겹치는.*거부' CLAUDE.md DESIGN.md docs/specs/intent-memo.md
```

Expected: no live-contract matches. Migration/history wording may remain only when explicitly labelled legacy.

**Verification:** 2026-08-17 authority audit returned no obsolete live-contract matches across `CLAUDE.md`, `DESIGN.md`, and `docs/specs/intent-memo.md`.

## Task 2: Lock version-2 settings migration with tests

**Files:**
- Modify: `src/lib/settings.test.ts`
- Modify: `src/types/library.ts:43-105`
- Modify: `src/lib/settingsParsing.ts`
- Modify: `src/lib/settings.ts:8-57`

- [x] **Step 1: Replace settings fixtures with the version-2 shape**

Use this final type contract in test fixtures:

```ts
{
  settingsSchemaVersion: 2,
  docsRoots: [
    { root: "/work/pinned", label: "P" },
    { root: "/work/open", label: null },
  ],
  docsRoot: "/work/open",
  tabSessions: {
    intent: { paths: [], activePath: null },
    docs: {
      "/work/pinned": { paths: ["result.md"], activePath: "result.md" },
      "/work/open": { paths: ["draft.md"], activePath: "draft.md" },
    },
  },
}
```

- [x] **Step 2: Add failing migration tests**

Add named cases covering:

```ts
it("migrates current Browse and Pinned roots into pinned-first version 2")
it("stable-unions duplicate-root sessions with the last valid mode first")
it("defaults malformed or missing legacy mode to Browse precedence")
it("promotes legacy docsRoot and one tabSessions.docs session")
it("promotes legacy string docsRoots without confusing them with version 2 entries")
it("keeps a root and session when its stored label normalizes to null")
it("drops only sessions whose root is absent from normalized docsRoots")
it("stably repairs interleaved pinned and unpinned version 2 entries")
it("deletes retired top-level keys after a successful version 2 save")
```

The duplicate-root expectation must be exact:

```ts
expect(settings.tabSessions.docs["/work/shared"]).toEqual({
  paths: ["pinned-active.md", "pinned-other.md", "browse-only.md"],
  activePath: "pinned-active.md",
});
```

- [x] **Step 3: Run the focused tests and confirm the old schema fails**

Run:

```bash
pnpm vitest run src/lib/settings.test.ts
```

Expected: FAIL on missing `settingsSchemaVersion`, unified fields, stable-union behavior, and retired-key deletion.

- [x] **Step 4: Replace public settings types**

Change `src/types/library.ts` to this model and remove `DocsSourceMode`, `DOCS_SOURCE_MODES`, and the separate Browse/Pinned fields:

```ts
export type DocsRootEntry = {
  readonly root: string;
  readonly label: string | null;
};

export type LayoutSettings = {
  readonly settingsSchemaVersion: 2;
  readonly libraryRoot: string | null;
  readonly docsRoots: readonly DocsRootEntry[];
  readonly docsRoot: string | null;
  // existing non-AI settings stay unchanged
  readonly tabSessions: {
    readonly intent: TabSession;
    readonly docs: DocsRootSessions;
  };
};
```

- [x] **Step 5: Implement version-first parsing and normalization**

In `src/lib/settingsParsing.ts`:

1. Parse version-2 roots only when `settingsSchemaVersion === 2`.
2. Otherwise parse current Browse/Pinned fields; only when absent use the legacy string `docsRoots` and single `docsRoot` inputs.
3. Parse each root independently from its label so invalid labels become `null` without dropping the root.
4. Deduplicate by canonical root, keeping a pinned entry over an unpinned duplicate.
5. Stable-partition pinned entries before unpinned entries.
6. Merge duplicate sessions using preferred-mode paths first, then secondary unique paths; choose a valid preferred active path, then a valid secondary active path, then `null`.
7. Normalize `docsRoot` to a member of `docsRoots`, otherwise the first entry, otherwise `null`.

- [x] **Step 6: Implement version-2 persistence and retired-key deletion**

Extend the LazyStore test double with `delete(key)`. `saveSettings()` must validate the complete version-2 snapshot, set only live settings, replace the whole `tabSessions` object, delete these keys, then call `store.save()`:

```ts
const retiredKeys = [
  "docsSourceMode",
  "docsBrowseRoots",
  "docsBrowseRoot",
  "docsPinnedRoots",
  "docsPinnedRoot",
] as const;
```

Do not write neutral placeholders to retired keys.

- [x] **Step 7: Run focused settings validation**

Run:

```bash
pnpm vitest run src/lib/settings.test.ts
pnpm exec biome check src/lib/settings.ts src/lib/settingsParsing.ts src/types/library.ts src/lib/settings.test.ts
```

Expected: all settings tests pass and Biome reports no diagnostics.

**Verification:** The red run failed all five new version-2 boundary cases against the old schema. `pnpm exec vitest run src/lib/settings.test.ts` then passed 34 tests, and the targeted Biome check passed.

## Task 3: Make every workspace reload use the injected scanner

**Files:**
- Modify: `src/hooks/useLibraryWorkspace.test.tsx`
- Modify: `src/hooks/useLibraryWorkspace.ts:70-260,529-590`

- [x] **Step 1: Add a failing AI reload scanner regression**

Add a hook test with an injected `scan` mock, open an active document, invoke `reloadCurrentDocument()`, and assert:

```ts
expect(scan).toHaveBeenCalledWith("/work/ai");
expect(native.scanLibrary).not.toHaveBeenCalled();
```

- [x] **Step 2: Run the regression and observe the hard-coded Human scan**

Run:

```bash
pnpm vitest run src/hooks/useLibraryWorkspace.test.tsx -t "uses the injected scanner when reloading"
```

Expected: FAIL because reload currently calls `scanLibrary(current.root)`.

- [x] **Step 3: Route reload through `scanRef.current`**

Replace the hard-coded reload scan with:

```ts
const [payload, nextSnapshot] = await Promise.all([
  readDocument(current.root, current.path),
  scanRef.current(current.root),
]);
```

Keep Human behavior unchanged because Human supplies the default `scanLibrary` scanner.

- [x] **Step 4: Add preflight snapshot handoff**

Extend workspace options with `initialSnapshot?: LibrarySnapshot`. During initialization, use that snapshot once instead of rescanning, then restore the session from it. This prevents activation from persisting settings after a successful preflight only to fail on an immediate duplicate scan.

- [x] **Step 5: Run the hook suite**

Run:

```bash
pnpm vitest run src/hooks/useLibraryWorkspace.test.tsx
```

Expected: all hook tests pass, including unavailable-session preservation and injected reload scanning.

**Verification:** Both injected-reload and preflight-snapshot tests failed before the hook change, then `pnpm exec vitest run src/hooks/useLibraryWorkspace.test.tsx` passed all 22 tests; targeted Biome passed.

## Task 4: Build the unified Source Card behind component tests

**Files:**
- Modify: `src/components/DocsRootSwitcher.test.tsx`
- Modify: `src/components/DocsRootSwitcher.tsx`
- Delete after replacement coverage: `src/components/PinnedRootsSwitcher.test.tsx`
- Delete after replacement coverage: `src/components/PinnedRootsSwitcher.tsx`
- Modify: `src/lib/i18n.test.ts`
- Modify: `src/lib/i18n.ts`
- Modify: `src/index.css:920-1345`

- [x] **Step 1: Replace component tests with unified root entries**

Cover these observable scenarios:

```ts
it("renders pinned split controls before the open-folder action and unpinned tabs on row two")
it("selects a root from the primary button without opening its menu")
it("opens the requested root menu without changing the active root")
it("offers Edit label and Unpin for pinned entries")
it("offers Pin and Close for unpinned entries")
it("offers targeted Refresh for unavailable pinned and unpinned entries")
it("supports Arrow, Home, End, Enter, Space, and Escape in the action menu")
it("restores focus to the moved root after Unpin")
it("restores focus right then left after Close")
```

- [x] **Step 2: Run the component suite and verify it fails against the Browse-only component**

Run:

```bash
pnpm vitest run src/components/DocsRootSwitcher.test.tsx
```

Expected: FAIL because the component accepts `string[]` and has no per-root menu or pinned row.

- [x] **Step 3: Implement one switcher contract**

Use props equivalent to:

```ts
type RootAvailability = "available" | "unavailable";

type DocsRootSwitcherProps = {
  readonly roots: readonly DocsRootEntry[];
  readonly activeRoot: string | null;
  readonly availability: ReadonlyMap<string, RootAvailability>;
  readonly onOpenFolder: () => void;
  readonly onSelect: (root: string) => Promise<boolean>;
  readonly onPin: (root: string, opener: HTMLElement) => void;
  readonly onUnpin: (root: string) => void;
  readonly onEditLabel: (root: string, opener: HTMLElement) => void;
  readonly onClose: (root: string) => Promise<boolean>;
  readonly onRefresh: (root: string) => Promise<boolean>;
};
```

The switcher owns menu open/close, keyboard movement, and focus restoration. `App` owns dialogs and state transitions.

- [x] **Step 4: Replace source-mode translations**

Remove live `docsSourceModes` copy and add localized names for the root group, select root, open actions menu, Pin, Unpin, Edit label, Close, Refresh unavailable root, and unavailable status. Every root control name must include basename and canonical path; pinned select names also include the label.

- [x] **Step 5: Implement the two-row visual contract**

Retain `.source-card` at `78px` with two `39px` rows. Use horizontal scrolling for both rows, visible focus rings, a compact split-control border, an unavailable visual state that does not rely on color alone, and no third row.

- [x] **Step 6: Remove the obsolete component only after replacement tests pass**

Delete `PinnedRootsSwitcher.tsx` and its test after all imports and behavior have moved to `DocsRootSwitcher`.

- [x] **Step 7: Run component, i18n, and static checks**

Run:

```bash
pnpm vitest run src/components/DocsRootSwitcher.test.tsx src/lib/i18n.test.ts
pnpm exec biome check src/components/DocsRootSwitcher.tsx src/components/DocsRootSwitcher.test.tsx src/lib/i18n.ts src/lib/i18n.test.ts src/index.css
```

Expected: all focused tests pass and there are no stale `PinnedRootsSwitcher` imports.

**Verification:** The replacement component tests first failed against the Browse-only contract; after the unified split controls, menus, i18n, and two-row styling landed, `pnpm exec vitest run src/components/DocsRootSwitcher.test.tsx src/lib/i18n.test.ts` passed 11 tests and targeted Biome passed. The obsolete PinnedRootsSwitcher files were then removed.

## Task 5: Replace App mode branches with one transactional root lifecycle

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx:314-1041,1256-1435`
- Modify: `src/lib/settings.ts:49-57`

- [x] **Step 1: Replace App fixtures with unified settings**

Remove source-mode fixtures and add exact tests for:

```ts
it("opens the first AI folder without a mode choice")
it("reactivates an exact canonical root instead of adding a duplicate")
it("allows canonical ancestor and descendant roots as independent tabs")
it("does not add or activate a new root when canonicalize or preflight scan fails")
it("keeps the mounted workspace when selecting an unavailable existing tab")
it("marks only the failed target root unavailable")
it("activates and restores a target only after targeted Refresh succeeds")
it("falls back to the first available ordered root during startup recovery")
it("shows an unavailable placeholder when no startup root can be scanned")
it("pins an inactive root without remounting or replacing its session")
it("unpins an active root without a save barrier or confirmation")
it("closes an active unpinned root using right-then-left fallback")
it("keeps state unchanged when settings persistence fails")
```

- [x] **Step 2: Run focused App tests and confirm the mode-dependent implementation fails**

Run:

```bash
pnpm vitest run src/App.test.tsx
```

Expected: FAIL on removed settings fields, first-entry mode selector, separate switchers, and missing transactional activation.

- [x] **Step 3: Make settings updates persistence-first**

Serialize updates through the existing queue, but compute and publish the next state only after `saveSettings(next)` succeeds:

```ts
const write = settingsWriteQueueRef.current.then(async () => {
  const current = settingsRef.current;
  if (!current) return;
  const next = update(current);
  if (Object.is(current, next)) return;
  await saveSettings(next);
  settingsRef.current = next;
  setSettings(next);
});
```

Keep the queue alive after rejection, surface the operation error, and never optimistically publish a failed settings snapshot.

- [x] **Step 4: Replace RuntimeContent mode selection with unified bootstrap**

Derive the AI root only from `settings.docsRoot`. When `docsRoots` is empty, show one `Open AI folder` action. On startup, scan the stored active root; if it fails, scan remaining roots in order and persist the first successful fallback. If all fail, mount the stored root as an unavailable placeholder without emitting an empty session.

- [x] **Step 5: Implement one activation transaction**

Use this order for new or existing roots:

```text
resolve canonical root
persist all documents in the current workspace
scanDocsRoot(target)
store the successful snapshot for one-time handoff
persist docsRoots/docsRoot/tabSessions.docs
mount the target workspace from the preflight snapshot
```

On scan failure, keep `docsRoot`, mounted buffers, and settings unchanged; update only the target root's runtime availability to `unavailable`.

- [x] **Step 6: Implement targeted Refresh and runtime maps**

Maintain root-keyed runtime maps for `{ selectedFolder, expandedPaths }` and availability in `RuntimeContent`, outside the keyed workspace. Targeted Refresh must scan the requested root, pass the current save barrier, persist `docsRoot`, and mount the preserved session only after success.

- [x] **Step 7: Implement pin, unpin, edit, and close as list transformations**

Use deterministic transformations:

```text
Pin: remove root from current position, set label, insert after the last pinned entry.
Unpin: remove root from current position, set label null, insert before the first existing unpinned entry.
Edit label: replace only label in place.
Close inactive: remove root/session and keep docsRoot.
Close active: save, remove root/session, select entry at removed index, otherwise previous, otherwise null.
```

Pin opens the existing `NameDialog` with `suggestDocsFolderLabel(root)` and `validateDocsFolderLabel`; Edit label uses the same validation. Confirm and cancel restore focus to the originating ellipsis opener. Pin/Unpin/Edit must not call `persistAllOpenDocuments`, delete the session, or remount when `docsRoot` is unchanged.

- [x] **Step 8: Replace all App render sites with `DocsRootSwitcher`**

Use the same unified Source Card in the folder pane and two-pane list fallback. Remove `DocsSourceModeSelect`, Pinned/Browse branches, overlap validation, and the unpin confirmation. Keep content-only free of Source Card controls and keep the AI Document List header order `Refresh → Sort → Density → Open Folder` for every root.

- [x] **Step 9: Run the App suite**

Run:

```bash
pnpm vitest run src/App.test.tsx
```

Expected: all unified lifecycle, migration handoff, focus, and failure-preservation tests pass.

**Verification:** Focused unified lifecycle tests passed 11 scenarios. After updating the remaining historical assertion and adding focus restoration for a root moved by Pin, `pnpm exec vitest run src/App.test.tsx` passed all 65 tests.

## Task 6: Remove obsolete contracts and verify the complete artifact

**Files:**
- Modify only as required by diagnostics: existing files changed in Tasks 1-5
- Verify: `docs/plans/2026-08-17-ai-unified-pin-tabs.md`
- Verify: `docs/plans/2026-08-17-ai-unified-pin-tabs-implementation.md`

- [x] **Step 1: Audit obsolete runtime symbols**

Run:

```bash
rg -n 'DocsSourceMode|DOCS_SOURCE_MODES|docsSourceMode|docsBrowseRoots|docsBrowseRoot|docsPinnedRoots|docsPinnedRoot|docsBrowse|docsPinned|PinnedRootsSwitcher|pathsOverlap' src CLAUDE.md DESIGN.md docs/specs/intent-memo.md
```

Expected: no live product-code or authority matches. Legacy names may appear only in migration parser/tests and explicitly historical plan text.

**Verification:** The audit found no live UI or authority symbols. All remaining matches are intentionally isolated to the version-2 migration reader, retired-key deletion, and migration tests.

- [x] **Step 2: Run all frontend checks once**

Run:

```bash
pnpm test
pnpm check
pnpm build
```

Expected: Vitest, Biome, TypeScript, and Vite all exit 0.

**Verification:** `pnpm test` passed 17 files / 182 tests, `pnpm check` checked 60 files with no fixes, and `pnpm build` completed TypeScript plus the Vite production bundle. CodeMirror emitted its known jsdom geometry stderr while the affected tests still passed.

- [x] **Step 3: Run native regression checks**

Run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

Expected: all commands exit 0. No Rust behavior change is expected.

**Verification:** `cargo fmt --check` passed, `cargo test` passed 19 library tests, and strict `cargo clippy` completed with no warnings.

- [x] **Step 4: Run repository integrity checks**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; status contains only intentional plan/product/test changes and no generated artifacts.

**Verification:** `git diff --check` returned clean. `git status --short` contains the intended unified-mode docs/product/tests plus the two pre-existing modified plan documents; no generated build artifact is tracked.

- [x] **Step 5: Perform real Tauri desktop QA**

Run `pnpm tauri:dev` and verify this observable sequence with temporary visible folders:

1. First AI entry shows only `Open AI folder`.
2. Open roots A and B; each restores its own document tabs.
3. Pin inactive B, edit its label, then unpin it; active root and B session remain unchanged.
4. Pin A; pinned shortcuts stay on row one and unpinned B stays on row two.
5. Open the ellipsis menu by mouse and keyboard; verify focus entry, Arrow/Home/End, Escape, and focus restoration.
6. Make B unavailable on disk, select it, and confirm A remains mounted while B is marked unavailable.
7. Restore B and use B's targeted Refresh; confirm B activates with its prior session.
8. Close active unpinned B and verify fallback to pinned A. Unpin A, close A, and verify `docsRoots: []` with `docsRoot: null`.
9. Restart and confirm version-2 roots, labels, order, active root, and sessions restore.

Record the temporary input paths and one screenshot showing pinned row, unpinned row, and an open action menu. Stop the dev process after verification.

**Verification:** The complete lifecycle ran in isolated real Tauri instances against `/private/tmp/intent-unified-qa-1786913217/{human,A,B}` and the isolated `app.tkbetter.intentmemo.unifiedqa1786913217` store. It covered first entry, per-root session restore, pin/edit/unpin, mouse and keyboard menu behavior, unavailable-root retention, targeted Refresh, close fallback, empty-state cleanup, and restart recovery. `/tmp/intent-unified-final-menu.png` records the real Tauri pinned/unpinned/menu state. After adding the responsive contract, fresh real Tauri launches at 1024 px and 800 px observed the current build's `wide` and `narrow` media states; the dev processes were stopped.

## Task 7: Apply fixed-width typography to the left folder/file list

**Files:**
- Modify: `DESIGN.md`
- Modify: `src/index.css`
- Verify: `src/components/FolderTree.tsx`
- Verify: `src/components/FileExplorerTree.tsx`

- [x] **Step 1: Extend the typography contract**

Add a shared `--fixed-font` stack to the design system and explicitly scope it to the left pane folder/file hierarchy. Do not change the center document list or Markdown writing surfaces.

- [x] **Step 2: Apply the shared font to both left-pane tree variants**

Apply `font-family: var(--fixed-font)` to `.folder-tree` and `.file-explorer-tree` so Human folder navigation and the unified AI folder/file explorer use the same fixed-width typography.

- [x] **Step 3: Verify the final surface**

Run targeted Biome/static checks, repeat the full frontend checks after the CSS change, and include the fixed-width tree in the final real Tauri screenshot evidence.

**Verification:** The final frontend and Rust checks above remained green. Current-build computed styles reported `SFMono-Regular, "Cascadia Code", monospace` for `.file-explorer-tree` and the unchanged system sans stack for `.list-pane`. Fresh English and Korean wide/narrow evidence is recorded at `/tmp/intent-unified-final-wide-menu.png`, `/tmp/intent-unified-final-narrow.png`, `/tmp/intent-unified-final-cjk-wide.png`, and `/tmp/intent-unified-final-cjk-narrow.png`. Independent code/design and visual/CJK reviewers both returned PASS with no blocking findings.

## Task 8: Separate pinned shortcuts from the complete open-root path list

**Files:**
- Modify: `CLAUDE.md`
- Modify: `DESIGN.md`
- Modify: `docs/specs/intent-memo.md`
- Modify: `src/components/DocsRootSwitcher.test.tsx`
- Modify: `src/components/DocsRootSwitcher.tsx`
- Modify: `src/lib/rootDisplay.test.ts`
- Modify: `src/lib/rootDisplay.ts`
- Modify: `src/lib/i18n.ts`
- Modify: `src/index.css`

- [x] **Step 1: Amend the Source Card contract**

Replace the pinned/unpinned row split with this observable model:

```text
header: [A] [B] [Open AI Folder]
list:   [A | …/aaa/bbb] […]
        [B | …/ccc/ddd] […]
```

The header contains pinned label shortcuts only. The vertical list contains every open root in stored order. Every visible path keeps the final two segments and prefixes deeper paths with an ellipsis; pinned rows also show their label and a divider. Canonical paths remain available through tooltip and accessible text.

- [x] **Step 2: Add failing component coverage**

Lock the following boundaries before changing production code:

```ts
it("shows pinned labels only in the shortcut header")
it("shows every open root in the vertical path list")
it("prefixes pinned path rows with their label")
it("keeps canonical paths in titles and accessible names")
```

Run the focused test and confirm it fails against the old unpinned-only second row.

**Verification:** `DocsRootSwitcher` first failed the four new layout assertions because the header still owned split controls and the second row omitted pinned roots. `formatCompactRootPath` then failed two focused cases because the compact formatter did not exist.

- [x] **Step 3: Render shortcuts and path rows as separate controls**

Keep the existing root/session behavior unchanged. Render label-only selection shortcuts for pinned roots in the header, then render every root as a fixed-font path row with a select button and its existing ellipsis menu. Keep unavailable state, focus restoration, targeted Refresh, Pin/Edit/Unpin/Close, and menu keyboard behavior intact.

- [x] **Step 4: Let the AI card grow to a bounded scrolling list**

Keep the 39px header. Let the AI Source Card grow with one 32px row per root up to four visible rows; overflow scrolls inside the path list so the explorer remains usable. Human retains its fixed 78px two-row card.

**Verification:** The header now renders label-only pinned shortcuts, and a semantic list renders every root with `formatCompactRootPath`, fixed-font path copy, canonical tooltip/accessibility data, and the existing action menu. Focused Vitest passed 20 tests across the switcher, path formatter, and i18n; targeted Biome passed six changed frontend files.

- [x] **Step 5: Move Pin and Unpin out of the dropdown**

Add a direct Pin toggle to every path row. The unpinned state is visually muted but remains enabled; clicking it opens the existing label dialog, and successful save applies the pin plus accent/fill state. Clicking a pinned toggle immediately unpins and restores focus to the same root's moved toggle. Remove `Pin` and `Unpin` from the dropdown, leaving `Edit label` for pinned rows or `Close` for unpinned rows, with `Refresh` prepended when unavailable.

**Verification:** Four focused interaction assertions first failed because no direct toggle existed. The updated switcher now exposes localized `aria-pressed` Pin controls, passes the unpinned control as the label-dialog opener, immediately unpins and restores focus to the moved control, and keeps Pin/Unpin out of the menu. Focused Vitest passed 14 switcher/i18n tests and targeted Biome passed.

- [x] **Step 6: Verify the updated surface**

Run the focused switcher tests, full frontend tests, Biome, and production build. Reproduce the open → pin A → add second root → pin B sequence in a fresh real-app capture, verify the bounded list at narrow width, and obtain fresh independent design-system and visual/CJK PASS verdicts.

**Verification:** `pnpm test && pnpm check && pnpm build` passed with 17 Vitest files / 187 tests, 60 Biome-checked files, and a successful TypeScript/Vite production build. Fresh isolated Tauri captures at 1024px and 800px confirmed label-only header shortcuts, the all-root fixed-font list, required compact path labels, and distinct muted-outline versus accent-filled Pin states without overlap. Independent design-system/functional-integrity and visual/CJK reviewers both returned PASS with no blockers.

## Completion criteria

- All five decisions in the source design are implemented exactly.
- Authority docs and runtime code expose one unified AI folder-tab model.
- Current and supported legacy settings migrate without root or open-tab session loss.
- Scan/settings failures preserve the current workspace and stored sessions.
- Unified menus pass keyboard/focus tests and real desktop interaction.
- Every root row exposes the direct Pin toggle; off is muted-outline, on is accent-filled, and the overflow menu no longer contains Pin/Unpin.
- The shortcut header contains only pinned labels, while the vertical fixed-font list contains every open root as `…/parent/leaf` and prefixes pinned rows with `label |`.
- Human and AI left-pane folder/file hierarchies use the shared fixed-width font without changing document-list or writing-surface typography.
- Frontend, Rust, build, static checks, and manual Tauri QA are green.
- No commit or push is created.

### Task 9: Rename the Human Source Card label

**Files:**
- Modify: `src/lib/i18n.test.ts`
- Modify: `src/lib/i18n.ts`
- Modify: `src/components/SpaceSwitcher.test.tsx`

- [x] **Step 1: Lock the approved product label**

Change the English and Korean localization assertions so the Human Source Card label is exactly `Tasteful Intents` in both languages. Update the component assertion to verify the same language-neutral product name.

- [x] **Step 2: Verify the test fails against the previous copy**

Run `pnpm test -- src/lib/i18n.test.ts src/components/SpaceSwitcher.test.tsx` and confirm the assertions fail because the runtime still returns `Tasteful Intent Library` and `Tasteful Intent 라이브러리`.

- [x] **Step 3: Apply the minimal localization change**

Change only `space.libraryLabel` in the English and Korean dictionaries to `Tasteful Intents`. Do not change the application title, mode labels, or accessibility behavior.

- [x] **Step 4: Verify tests, checks, build, and the real Human surface**

Run the focused tests, full frontend tests, Biome/type checks, and production build. Capture the Human Source Card in the isolated Tauri app and obtain independent design-system and visual/CJK PASS verdicts.

**Verification:** The three updated assertions first failed against `Tasteful Intent Library` and `Tasteful Intent 라이브러리`. After changing only the two locale values, focused Vitest passed 12/12 and the full suite passed 17 files / 187 tests. Biome checked 60 files and the TypeScript/Vite production build passed. A fresh isolated Tauri Human-mode capture showed `Tasteful Intents` fully visible without truncation, and both independent design-system/functional and visual/CJK reviewers returned PASS with no blockers.
