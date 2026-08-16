# AI Source Modes Implementation Plan

> **2026-08-16 revision notice:** Task 1~9는 기존 `Open Files | Pinned Folders` 계약으로 완료된 구현 기록이다. 현재 실행 대상은 이 문서 끝의 Folder-first revision Task 10~15다. 이전 Task는 회귀 근거로 보존하며 재실행하지 않는다.
>
> 고정 모드의 left pane은 선택한 사용자 label을 `[A] <folder basename>` 또는 `[AB] <folder basename>` root row로 표시하고, 그 아래 실제 file/folder 계층을 함께 렌더링하는 collapsible file explorer로 재설계한다. file row는 문서를 열고 folder row는 inline expand/collapse한다.
>
> combined explorer를 추가해도 AI의 가운데 document-list pane은 유지한다. 최종 AI anatomy는 `Explorer | Document List | Content`다.
> 가운데 Document List는 Explorer에서 선택한 folder의 직접 포함 Markdown 파일만 표시하고 descendant 문서를 재귀적으로 합치지 않는다.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace file-first AI Open Files with folder-first `Browse | Pinned`: Browse restores one replaceable folder, Pinned restores multiple custom-labeled folders, and both use the same read-only file explorer plus direct-child document list.

**Architecture:** `docsSourceMode` selects exactly one mounted root-local AI workspace. Browse owns one canonical root/session; Pinned owns ordered `{ root, label }` entries and one session per root. Both use the same ignore-aware native scanner and `FileExplorerTree`. Every mode/root transition crosses `persistAllOpenDocuments()` before settings or mounted workspace identity changes.

**Tech Stack:** React 19, TypeScript 5.5, Vitest/Testing Library, Zod 4, Tauri 2, Rust 2024, `ignore` crate, Biome.

**Design source:** `docs/plans/2026-08-15-ai-pinned-roots.md`

**Git boundary:** Do not commit or push. The user owns Git operations. Each task ends with a diff/checkpoint command instead of an agent-authored commit.

---

## Historical file map for completed Tasks 1~9

### Create

- `src/components/PinnedRootsSwitcher.tsx` — Pinned Folder shortcuts, active-root disclosure, pin action, root selection, unpin focus lifecycle.
- `src/components/PinnedRootsSwitcher.test.tsx` — component-level keyboard, labeling, select, pin, unpin, and focus regressions.

### Modify

- `src/types/library.ts` — `DocsSourceMode`, pinned-root settings fields, and root-local pinned session types.
- `src/lib/settings.ts` — defaults, field-level parsing, pinned session sanitization, and legacy Open Files preservation.
- `src/lib/settings.test.ts` — settings defaults, round-trip, invalid-field isolation, and pinned session membership tests.
- `src-tauri/Cargo.toml` / `src-tauri/Cargo.lock` — direct `ignore` dependency.
- `src-tauri/src/library.rs` — canonical pinned-root resolution and git-aware Markdown scan.
- `src-tauri/src/lib.rs` — register `resolve_library_root` and `scan_pinned_root`.
- `src/lib/native.ts` — typed adapters for the two new native commands.
- `src/hooks/useLibraryWorkspace.ts` — injectable scanner, failed-initial-scan session guard, and initial selected folder support.
- `src/hooks/useLibraryWorkspace.test.tsx` — preserve session on unavailable root and use the injected scanner.
- `src/components/FolderTree.tsx` — opt-in collapse state used only by Pinned Folders.
- `src/components/DocsRootSwitcher.tsx` / `src/components/DocsRootSwitcher.test.tsx` — accept the shared leading mode selector without changing Open Files behavior.
- `src/App.tsx` / `src/App.test.tsx` — two-mode orchestration, pinned runtime navigation cache, transactions, empty/error states, and unpin confirmation.
- `src/lib/i18n.ts` / `src/lib/i18n.test.ts` — English/Korean mode, pin, overlap, missing-root, and unpin copy.
- `src/index.css` — compact mode selector, Pinned switcher, collapse affordance, and existing 78px Source Card geometry.
- `CLAUDE.md`, `DESIGN.md`, `docs/specs/intent-memo.md` — final product/UI/filesystem/smoke contracts.

---

## Historical completed implementation

### Task 1: Add the persisted AI source-mode and pinned-session model

**Files:**
- Modify: `src/types/library.ts:43-101`
- Modify: `src/lib/settings.ts:18-276`
- Test: `src/lib/settings.test.ts`

- [x] **Step 1: Write failing default and round-trip tests**

Add assertions that the default settings contain:

```ts
{
  docsSourceMode: "open-files",
  docsRoots: [],
  docsPinnedRoot: null,
  tabSessions: {
    intent: { paths: [], activePath: null },
    docs: { documents: [], active: null },
    docsPinned: {},
  },
}
```

Add a round-trip case with two roots and separate sessions:

```ts
docsSourceMode: "pinned-folders",
docsRoots: ["/work/task-a", "/work/task-b"],
docsPinnedRoot: "/work/task-b",
tabSessions: {
  intent: { paths: [], activePath: null },
  docs: { documents: [{ root: "/tmp", path: "one.md" }], active: { root: "/tmp", path: "one.md" } },
  docsPinned: {
    "/work/task-a": { paths: ["docs/a.md"], activePath: "docs/a.md" },
    "/work/task-b": { paths: ["docs/b.md"], activePath: "docs/b.md" },
  },
}
```

Assert that saving and loading preserves both modes independently.

- [x] **Step 2: Write failing sanitization tests**

Cover these exact boundaries:

```ts
// invalid mode falls back without resetting valid roots or sessions
docsSourceMode: "unknown"

// duplicate/blank roots sanitize to first-occurrence non-empty values
docsRoots: ["/work/a", "", "/work/a", "/work/b"]

// active root must belong to docsRoots
docsPinnedRoot: "/not-pinned"

// pinned paths retain current AI validation
paths: ["good.md", "nested/good.md", "../bad.md", ".hidden.md", "bad.txt"]

// activePath must be a surviving member of paths
activePath: "missing.md"

// sessions for unpinned roots are discarded; sessions for missing-on-disk but still pinned roots remain
```

- [x] **Step 3: Run the settings tests and confirm RED**

Run:

```bash
pnpm test src/lib/settings.test.ts
```

Expected: FAIL because `LayoutSettings` and stored settings do not contain the new fields.

- [x] **Step 4: Add exact TypeScript types**

Add to `src/types/library.ts`:

```ts
export const DOCS_SOURCE_MODES = ["open-files", "pinned-folders"] as const;
export type DocsSourceMode = (typeof DOCS_SOURCE_MODES)[number];
export type DocsPinnedSessions = Readonly<Record<string, TabSession>>;

export type LayoutSettings = {
  readonly libraryRoot: string | null;
  readonly docsRoot: string | null;
  readonly docsSourceMode: DocsSourceMode;
  readonly docsRoots: readonly string[];
  readonly docsPinnedRoot: string | null;
  readonly activeSpace: Space;
  readonly folderPaneOpen: boolean;
  readonly listPaneOpen: boolean;
  readonly documentDensity: DocumentDensity;
  readonly documentSort: DocumentSort;
  readonly theme: Theme;
  readonly spacePalette: SpacePalette;
  readonly language: Language;
  readonly writingFont: WritingFont;
  readonly tabSessions: {
    readonly intent: TabSession;
    readonly docs: DocsTabSession;
    readonly docsPinned: DocsPinnedSessions;
  };
};
```

- [x] **Step 5: Add field-level Zod parsing without weakening AI path validation**

Use these schemas and normalization rules in `src/lib/settings.ts`:

```ts
const docsSourceModeSchema = z.enum(DOCS_SOURCE_MODES);
const docsRootsSchema = z.array(z.string().min(1));
const docsPinnedSessionSchema = z.object({
  paths: z.array(relativeDocumentPathSchema),
  activePath: relativeDocumentPathSchema.nullable(),
});

function normalizeTabSession(session: TabSession): TabSession {
  const paths = [...new Set(session.paths)];
  return {
    paths,
    activePath:
      session.activePath && paths.includes(session.activePath)
        ? session.activePath
        : null,
  };
}

function parsePinnedSessions(
  value: unknown,
  roots: readonly string[],
): LayoutSettings["tabSessions"]["docsPinned"] {
  const record = isRecord(value) ? value : {};
  return Object.fromEntries(
    roots.flatMap((root) => {
      const parsed = docsPinnedSessionSchema.safeParse(record[root]);
      return parsed.success
        ? [[root, normalizeTabSession(parsed.data)] as const]
        : [];
    }),
  );
}
```

Keep the existing `docsDocumentRefSchema`, `parseStoredDocsSession`, and legacy relative-session migration for `tabSessions.docs`. Load missing new keys with `open-files`, `[]`, `null`, and `{}`. Save every new field through `settingsSchema.parse` and `store.set`.

- [x] **Step 6: Run the targeted tests and confirm GREEN**

Run:

```bash
pnpm test src/lib/settings.test.ts
```

Expected: all settings tests pass, including existing Open Files migration cases.

- [x] **Step 7: Check the task diff without committing**

Run:

```bash
git diff --check -- src/types/library.ts src/lib/settings.ts src/lib/settings.test.ts
```

Expected: exit 0.

**Verification (2026-08-16):** `pnpm test src/lib/settings.test.ts` 23/23 passed; `pnpm exec tsc -b --pretty false` and `git diff --check` exited 0.

---

### Task 2: Add canonical root resolution and git-aware pinned scanning

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/library.rs:1-104,305-350,461-524`
- Modify: `src-tauri/src/lib.rs:5-20`
- Modify: `src/lib/native.ts:1-118`

- [x] **Step 1: Add failing Rust tests for root identity and scan semantics**

Add inline tests in `src-tauri/src/library.rs` proving:

1. `resolve_library_root` returns `fs::canonicalize(selected)` for a real visible directory.
2. It rejects relative, missing, regular-file, selected paths containing a symlink component, and selected/canonical paths containing a hidden component.
3. `scan_pinned_root` includes visible `.md` documents.
4. It excludes `.gitignore`, `.ignore`, hidden, symlink, and non-Markdown entries.
5. It returns only folder rows that are ancestors of included Markdown documents.
6. A normal non-Git directory without ignore files is scanned recursively.

Use fixtures equivalent to:

```rust
let root = directory.path().join("task-a");
fs::create_dir_all(root.join("docs/plans"))?;
fs::create_dir_all(root.join("node_modules/pkg"))?;
fs::write(root.join(".gitignore"), "node_modules/\n")?;
fs::write(root.join("docs/plans/keep.md"), "# Keep")?;
fs::write(root.join("node_modules/pkg/drop.md"), "# Drop")?;
```

- [x] **Step 2: Run Rust tests and confirm RED**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml library::tests::resolve_library_root
cargo test --manifest-path src-tauri/Cargo.toml library::tests::scan_pinned_root
```

Expected: FAIL because the commands do not exist.

- [x] **Step 3: Add the approved dependency**

Add to `[dependencies]`:

```toml
ignore = "0.4"
```

Run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: exit 0 and `Cargo.lock` records `ignore` as a direct dependency of `intent-memo`.

- [x] **Step 4: Implement canonical root resolution**

Add a command with this public shape:

```rust
#[tauri::command]
pub fn resolve_library_root(path: String) -> CommandResult<String> {
    let selected = Path::new(&path);
    if has_hidden_component(selected) {
        return Err(error("hidden-path", "Hidden paths are not allowed"));
    }
    ensure_no_symlink_path(selected)?;
    let canonical = canonical_root(selected)?;
    if has_hidden_component(&canonical) {
        return Err(error("hidden-path", "Hidden paths are not allowed"));
    }
    canonical
        .to_str()
        .map(str::to_owned)
        .ok_or_else(|| error("invalid-root", "Library root must use valid UTF-8"))
}
```

Implement `ensure_no_symlink_path` by walking the existing absolute path component-by-component with `fs::symlink_metadata` and returning the existing `symlink` error when any component is a symlink. Keep the existing absolute/real-directory/final-symlink checks inside `canonical_root`. Do not store the dialog path before this command succeeds.

- [x] **Step 5: Implement the Pinned-only ignore walker**

Add `scan_pinned_root(root: String) -> CommandResult<LibrarySnapshot>` using `ignore::WalkBuilder` with links disabled and Git/ignore/hidden filtering enabled. Collect Markdown documents first, then derive the unique ancestor folder set so read-only Pinned Folders does not show empty branches. Sort folders by path and documents by `updated_ms` descending with path tie-break, matching `scan_library`.

The command must preserve the existing `LibrarySnapshot`, `FolderEntry`, and `DocumentEntry` wire shapes; do not change `scan_library`.

- [x] **Step 6: Register and expose typed adapters**

Register in `src-tauri/src/lib.rs`:

```rust
library::resolve_library_root,
library::scan_pinned_root,
```

Add to `src/lib/native.ts`:

```ts
const canonicalRootSchema = z.string().min(1);

export async function resolveLibraryRoot(path: string): Promise<string> {
  return await invokeParsed(
    "resolve_library_root",
    { path },
    canonicalRootSchema,
  );
}

export async function scanPinnedRoot(root: string): Promise<LibrarySnapshot> {
  return await invokeParsed(
    "scan_pinned_root",
    { root },
    librarySnapshotSchema,
  );
}
```

- [x] **Step 7: Run native validation**

Run:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

Expected: all commands exit 0.

**Verification (2026-08-16):** Rust tests 17/17 passed; `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, TypeScript build, and `git diff --check` exited 0.

---

### Task 3: Make workspace restoration safe for Pinned roots

**Files:**
- Modify: `src/hooks/useLibraryWorkspace.ts:49-294`
- Test: `src/hooks/useLibraryWorkspace.test.tsx`

- [x] **Step 1: Write failing hook tests**

Add tests for:

```ts
it("uses the injected scanner for a pinned workspace", async () => {
  const scan = vi.fn().mockResolvedValue({ folders: [], documents: [] });
  renderHook(() =>
    useLibraryWorkspace("/work/a", {
      defaultMode: "view",
      initialSession: { paths: [], activePath: null },
      scan,
    }),
  );
  await waitFor(() => expect(scan).toHaveBeenCalledWith("/work/a"));
  expect(native.scanLibrary).not.toHaveBeenCalled();
});

it("does not emit an empty session when the initial pinned scan fails", async () => {
  const onSessionChange = vi.fn();
  const scan = vi.fn().mockRejectedValue(
    new NativeCommandError("invalid-root", "Could not inspect library root"),
  );
  const { result } = renderHook(() =>
    useLibraryWorkspace("/missing", {
      defaultMode: "view",
      initialSession: { paths: ["docs/a.md"], activePath: "docs/a.md" },
      onSessionChange,
      scan,
    }),
  );
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.rootUnavailable).toBe(true);
  expect(onSessionChange).not.toHaveBeenCalled();
});
```

- [x] **Step 2: Run the hook tests and confirm RED**

Run:

```bash
pnpm test src/hooks/useLibraryWorkspace.test.tsx
```

Expected: FAIL because `scan` and `rootUnavailable` are not part of the hook contract and failed restore emits an empty session.

- [x] **Step 3: Extend the hook options and state**

Use this contract:

```ts
type WorkspaceOptions = {
  readonly defaultMode: EditorMode;
  readonly globalDocuments?: boolean;
  readonly initialSession?: TabSession | DocsTabSession;
  readonly initialSelectedFolder?: string;
  readonly onSelectedFolderChange?: (path: string) => void;
  readonly onSessionChange?: (session: TabSession | DocsTabSession) => void;
  readonly scan?: (root: string) => Promise<LibrarySnapshot>;
};
```

Initialize `selectedFolder` from `initialSelectedFolder ?? ""`, store `options.scan ?? scanLibrary` in a ref, and expose `rootUnavailable`. Mark only `NativeCommandError` code `invalid-root` as unavailable; keep other failures in the existing generic error surface.

- [x] **Step 4: Guard session emission until restoration succeeds**

Change the session effect precondition to:

```ts
if (loading || !initializedRef.current) return;
```

Set `initializedRef.current = true` only after a successful scan and reference restore. On a failed initial scan, leave the settings-backed session untouched. On later successful refresh, restore the original references and then emit only surviving paths.

Call `onSelectedFolderChange` whenever the committed selected folder changes; do not persist it in settings.

- [x] **Step 5: Run hook tests and confirm GREEN**

Run:

```bash
pnpm test src/hooks/useLibraryWorkspace.test.tsx
```

Expected: all existing global Open Files tests and the new Pinned restoration tests pass.

**Verification (2026-08-16):** hook tests 27/27 passed; TypeScript build and `git diff --check` exited 0.

---

### Task 4: Add opt-in collapsible Pinned folder navigation

**Files:**
- Modify: `src/components/FolderTree.tsx:1-198`
- Test: `src/App.test.tsx`

- [x] **Step 1: Add failing App-level folder navigation tests**

Import and render `FolderTree` directly inside a focused `describe("FolderTree collapsible mode")` block in `src/App.test.tsx`; this avoids introducing another test file. Assert:

1. Collapsible mode initially shows the root and first-level Markdown-bearing folders.
2. A collapsed folder hides its descendants.
3. Activating its chevron expands descendants without selecting a different folder.
4. The default non-collapsible mode keeps the existing always-expanded behavior.

- [x] **Step 2: Run the App test and confirm RED**

Run:

```bash
pnpm test src/App.test.tsx
```

Expected: FAIL because `FolderTree` has no collapse contract or per-root runtime state.

- [x] **Step 3: Add opt-in FolderTree props**

Extend `FolderTreeProps` without changing defaults:

```ts
type FolderTreeProps = {
  readonly folders: readonly FolderEntry[];
  readonly rootName: string;
  readonly selectedPath: string;
  readonly onSelect: (path: string) => void;
  readonly onMove: (path: string, origin: HTMLElement) => void;
  readonly onRename: (path: string, origin: HTMLElement) => void;
  readonly onTrash: (path: string, origin: HTMLElement) => void;
  readonly readOnly?: boolean;
  readonly collapsible?: boolean;
  readonly expandedPaths?: ReadonlySet<string>;
  readonly onToggleExpanded?: (path: string) => void;
};
```

When `collapsible !== true`, preserve the current recursive rendering exactly. When true, render children only if the parent path is expanded, give the chevron its own keyboard-accessible button, and set `aria-expanded` on folders with children. Selecting a row must not implicitly toggle it.

- [x] **Step 4: Run targeted tests and confirm GREEN**

Run:

```bash
pnpm test src/App.test.tsx
```

Expected: the new Pinned navigation tests and existing Human/Open Files tests pass.

**Verification (2026-08-16):** App tests 62/62 passed; TypeScript build and `git diff --check` exited 0. Existing CodeMirror/jsdom geometry warnings remain non-failing.

---

### Task 5: Build the Pinned Roots Source Card and shared mode selector slot

**Files:**
- Create: `src/components/PinnedRootsSwitcher.tsx`
- Create: `src/components/PinnedRootsSwitcher.test.tsx`
- Modify: `src/components/DocsRootSwitcher.tsx:8-224`
- Modify: `src/components/DocsRootSwitcher.test.tsx`
- Modify: `src/lib/i18n.ts`
- Modify: `src/lib/i18n.test.ts`

- [x] **Step 1: Write failing Pinned switcher tests**

Use this component contract:

```ts
type PinnedRootsSwitcherProps = {
  readonly roots: readonly string[];
  readonly activeRoot: string | null;
  readonly leadingControl: ReactNode;
  readonly onPin: () => void;
  readonly onSelect: (root: string) => Promise<boolean>;
  readonly onUnpin: (root: string) => Promise<boolean>;
};
```

Cover:

- first-occurrence A/B/C labels from `docsRoots` order;
- `FolderPlus` invokes `onPin`;
- shortcut and dropdown selection call `onSelect(root)`;
- successful unpin keeps the menu open and focuses the active/remaining row;
- cancelled/failed unpin keeps the row and focus;
- removing the last root unmounts the switcher cleanly;
- full canonical root remains in tooltip and accessible label;
- the supplied mode selector is the first control in the shortcut row.

- [x] **Step 2: Add failing Open Files regression for the leading slot**

Update `DocsRootSwitcher.test.tsx` to pass a labeled `leadingControl` and assert it precedes A/B/C while all existing Open File and close behavior remains unchanged.

- [x] **Step 3: Run switcher tests and confirm RED**

Run:

```bash
pnpm test src/components/DocsRootSwitcher.test.tsx src/components/PinnedRootsSwitcher.test.tsx
```

Expected: FAIL because the new component and leading slot do not exist.

- [x] **Step 4: Implement `PinnedRootsSwitcher`**

Reuse `createDocumentShortcutLabeler(roots)` and `formatRootDisplay(root)`. Keep the existing Source Card classes where geometry is identical, but use Pinned-specific class names for action and menu rows. The component must return `null` only when `roots.length === 0`; empty Pinned mode is handled by the App welcome surface.

The unpin handler must update focus only when `onUnpin(root)` resolves `true`; `false` means cancel/save failure and leaves the menu unchanged.

- [x] **Step 5: Add localized copy**

Extend `Messages` with explicit, structurally identical English/Korean fields for:

```ts
docsSourceModes: {
  selectorLabel: string;
  openFiles: string;
  pinnedFolders: string;
};
pinnedRoots: {
  groupLabel: string;
  menuLabel: string;
  shortcut: (label: string, root: string) => string;
  toggle: (label: string, root: string) => string;
  pinFolder: string;
  unpinFolder: (root: string) => string;
  confirmUnpin: (root: string, count: number) => string;
  overlap: string;
  missing: string;
  emptyTitle: string;
  emptyBody: string;
  chooseDocument: string;
};
```

Keep existing `docsRoots` and `app.chooseDocsRoot` copy unchanged for Open Files.

- [x] **Step 6: Run component and i18n tests and confirm GREEN**

Run:

```bash
pnpm test src/components/DocsRootSwitcher.test.tsx src/components/PinnedRootsSwitcher.test.tsx src/lib/i18n.test.ts
```

Expected: all tests pass.

**Verification (2026-08-16):** switcher/i18n tests 20/20 passed; full Biome check, TypeScript build, and `git diff --check` exited 0.

---

### Task 6: Orchestrate Open Files and Pinned Folders in App

**Files:**
- Modify: `src/App.tsx:254-443,515-885,940-1327`
- Test: `src/App.test.tsx`

- [x] **Step 1: Add failing integration tests for mode and root lifecycle**

Cover these observable sequences:

1. Missing `docsSourceMode` loads Open Files; selecting Pinned Folders persists it and restart restores it.
2. Mode switch calls `persistAllOpenDocuments()` before settings change; `false` leaves mode/tab/buffer unchanged.
3. Open Files continues to render `DocsRootSwitcher`, global two-line tabs, list-header Open File, and existing welcome.
4. Pinned Folders with no roots renders Pin Folder welcome.
5. Pin Folder resolves the canonical native root before storing it.
6. Exact existing root activates it after the save barrier without adding a duplicate.
7. Ancestor/descendant overlap shows the localized notice and changes no settings.
8. Pinned A and B retain independent `paths` and `activePath`; A→B→A restores A.
   The same transition also restores each root's runtime-only selected and expanded folder paths.
9. Pinned tabs are one-line and the list header has no Open File action.
10. Selecting Open Files from Pinned mode saves first; after the mode changes, the existing Open File action opens there without auto-pinning.
11. An unavailable pinned root keeps its pin/session and shows refresh/unpin actions.
12. Unpin with tabs asks for confirmation; cancel is a no-op; approval saves, removes root/session, renumbers labels, and selects right-then-left fallback.
13. Unpin without tabs skips confirmation.

- [x] **Step 2: Run App tests and confirm RED**

Run:

```bash
pnpm test src/App.test.tsx
```

Expected: FAIL on missing settings fields, mode selector, pinned root actions, and root-local sessions.

- [x] **Step 3: Select one mounted workspace identity**

Derive the active root and key as follows:

```ts
const docsMode = settings.docsSourceMode;
const root =
  settings.activeSpace === "intent"
    ? settings.libraryRoot
    : docsMode === "open-files"
      ? settings.tabSessions.docs.documents.length > 0
        ? settings.docsRoot
        : null
      : settings.docsPinnedRoot;

const workspaceKey =
  settings.activeSpace === "intent"
    ? `intent:${root}`
    : docsMode === "open-files"
      ? "docs:open-files"
      : `docs:pinned-folders:${root}`;
```

Open Files passes its existing global session and `globalDocuments: true`. Pinned Folders passes `tabSessions.docsPinned[root] ?? { paths: [], activePath: null }`, `globalDocuments: false`, and `scan: scanPinnedRoot`.

Create the shared leading control in `App.tsx` and pass it to either Source Card:

```tsx
<select
  aria-label={messages.docsSourceModes.selectorLabel}
  className="docs-source-mode-select"
  onChange={(event) => {
    void changeDocsSourceMode(event.currentTarget.value as DocsSourceMode);
  }}
  value={settings.docsSourceMode}
>
  <option value="open-files">{messages.docsSourceModes.openFiles}</option>
  <option value="pinned-folders">
    {messages.docsSourceModes.pinnedFolders}
  </option>
</select>
```

- [x] **Step 4: Implement one save-safe mode/root transaction**

Use a single helper inside `LibraryApp`:

```ts
const transitionAfterSave = async (
  update: (current: LayoutSettings) => LayoutSettings,
): Promise<boolean> => {
  if (!(await workspace.persistAllOpenDocuments())) return false;
  await onSettingsChange(update);
  return true;
};
```

All mode selection, exact-root selection, new pin activation, existing pin activation, pinned shortcut selection, unpin, and Pinned→Open File transitions must use this boundary. Do not change settings before it returns true.

- [x] **Step 5: Implement canonical pin and overlap rules**

After the directory picker returns, call `resolveLibraryRoot`. Compare path components, not string prefixes:

```ts
const sameOrNested = (left: string, right: string) => {
  const leftParts = left.split("/").filter(Boolean);
  const rightParts = right.split("/").filter(Boolean);
  const shared = Math.min(leftParts.length, rightParts.length);
  const prefixMatches = leftParts
    .slice(0, shared)
    .every((part, index) => part === rightParts[index]);
  return prefixMatches;
};
```

Exact match activates the existing root. Any non-exact ancestor/descendant match reports `messages.pinnedRoots.overlap` and leaves state unchanged. A disjoint root appends to `docsRoots`, creates no session until the first tab opens, and becomes `docsPinnedRoot` only after the save barrier.

- [x] **Step 6: Persist the active root-local session only**

When a Pinned workspace emits a `TabSession`, write:

```ts
tabSessions: {
  ...current.tabSessions,
  docsPinned: {
    ...current.tabSessions.docsPinned,
    [root]: session,
  },
}
```

Never replace `tabSessions.docs`, and never emit/write the pinned session while initial scan restoration has not succeeded.

Store Pinned navigation outside the keyed workspace and never persist it:

```ts
type PinnedNavigationState = {
  readonly selectedFolder: string;
  readonly expandedPaths: ReadonlySet<string>;
};

const pinnedNavigationRef = useRef(
  new Map<string, PinnedNavigationState>(),
);
```

Pass the active root's state into `LibraryApp`, update the map on selection/toggle, and give Human/Open Files no collapsible props.

- [x] **Step 7: Implement unpin confirmation and fallback**

Call `showConfirmation` only when `session.paths.length > 0`. The message must say files remain on disk and the open-tab state will be removed. After approval and save success, delete both the root and `docsPinned[root]`, then choose the root at the removed index or the preceding index. Return a boolean to `PinnedRootsSwitcher` so it can apply the correct focus behavior.

- [x] **Step 8: Keep mode-specific UI contracts**

- Open Files: existing welcome, `DocsRootSwitcher`, Open File list action, global source-qualified tabs with `docsMode={true}`.
- Pinned Folders: pin welcome or `PinnedRootsSwitcher`, collapsible read-only folder tree, no list Open File action, root-local one-line tabs with `docsMode={false}`.
- Both: Edit/View/Split, reload, find, PDF, autosave, and save conflict behavior remain shared.

- [x] **Step 9: Run App integration tests and confirm GREEN**

Run:

```bash
pnpm test src/App.test.tsx
```

Expected: all old Open Files/Human tests and new Pinned mode tests pass.

**Verification (2026-08-16):** App integration tests 68/68 passed; TypeScript build and `git diff --check` exited 0. Mode transitions use the shared save barrier, pins resolve canonically, overlap is rejected, and pinned sessions remain root-local.

---

### Task 7: Complete Source Card, tab, and responsive styling

**Files:**
- Modify: `src/index.css:776-1065`
- Modify: `src/components/TabBar.tsx`
- Test: `src/App.test.tsx`
- Test: `src/components/PinnedRootsSwitcher.test.tsx`

- [x] **Step 1: Lock the 78px geometry in tests**

Assert both AI modes render exactly one `.source-card`, the mode selector is inside the 39px shortcut row, and no third row/segmented strip appears. Preserve the existing `has-docs-tab` fallback only in Open Files mode.

- [x] **Step 2: Add minimal CSS**

Keep:

```css
.source-card {
  height: 78px;
  grid-template-rows: 39px 39px;
}
```

Add a fixed but shrinkable mode selector at the leading edge, retain horizontal shortcut overflow, style `FolderPlus`, missing-root notice/actions, Pinned menu rows, and folder expand buttons with existing sidebar tokens. Do not add new colors, shadows, radii, or animation timings.

- [x] **Step 3: Make TabBar mode explicit at the call site**

Do not add another TabBar mode enum. Continue using `docsMode` for the existing Open Files two-line/source-badge anatomy and pass `false` for Pinned Folders so it uses the Human-style one-line tab. Keep canonical full path in `title` and accessible name for Pinned tabs.

- [x] **Step 4: Run targeted UI tests**

Run:

```bash
pnpm test src/components/DocsRootSwitcher.test.tsx src/components/PinnedRootsSwitcher.test.tsx src/App.test.tsx
pnpm check
```

Expected: tests pass and Biome exits 0.

**Verification (2026-08-16):** Docs/Open and Pinned switcher plus App UI tests 86/86 passed. The 78px two-row Source Card is preserved, Pinned tabs are one-line with canonical path labels, and targeted Biome formatting completed.

---

### Task 8: Synchronize product and design contracts

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/specs/intent-memo.md`
- Modify: `DESIGN.md`
- Modify: `docs/plans/2026-08-15-ai-pinned-roots.md` only if implementation evidence requires correcting a factual statement

- [x] **Step 1: Update `CLAUDE.md`**

Replace the single Open File-only AI contract with explicit Open Files and Pinned Folders subsections. Preserve AI content editing and prohibit AI create/rename/move/Trash in both modes. Document `docsSourceMode`, canonical pinned roots, ignore-aware Pinned scan, root-local tabs, and save barriers.

- [x] **Step 2: Update the product spec**

Synchronize overview, included scope, clean defaults, Source Card, document-list actions, tab/session behavior, filesystem safety, error states, and smoke checklist. Explicitly state that existing Open Files settings are not migrated into pins.

- [x] **Step 3: Update `DESIGN.md`**

Document the first-row compact mode selector, unchanged 78px card height, Open Files and Pinned Folders anatomies, Pinned-only collapsible tree, one-line Pinned tabs, missing-root state, and unpin confirmation/focus behavior.

- [x] **Step 4: Scan for stale contradictory language**

Run:

```bash
rg -n "There is no folder add/remove UI|never registers a folder|AI folder setup|AI 전역 tab|AI Open File|FilePlus2|docsRoot projection" CLAUDE.md DESIGN.md docs/specs/intent-memo.md
```

Expected: every match is either Open Files-specific or updated to distinguish the two AI modes.

**Verification (2026-08-16):** `CLAUDE.md`, the v0.2 product spec, and `DESIGN.md` now distinguish Open Files and Pinned Folders; a targeted stale-language scan found no remaining Open-File-only AI contract.

---

### Task 9: Full automated verification and Manual QA Gate

**Files:**
- Verify all files listed above

- [x] **Step 1: Run the complete automated gate once**

Run:

```bash
pnpm test
pnpm check
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
git diff --check
```

Expected: every command exits 0. Do not rerun an unchanged green command.

- [x] **Step 2: Build and launch the real desktop app**

Run the existing Tauri development or updater-disabled production path used by the repository. Use temporary test folders outside user data:

```text
/tmp/intent-memo-ai-modes/task-a/
  .gitignore
  docs/plans/a.md
  docs/specs/b.md
  ignored/drop.md
/tmp/intent-memo-ai-modes/task-b/
  docs/plans/a.md
```

Ensure `.gitignore` contains `ignored/`.

- [x] **Step 3: Manually prove Open Files remains unchanged**

Observe in the real Tauri UI:

1. Existing/default mode is Open Files.
2. Open two files from different parents and observe current A/B shortcuts and two-line source-qualified tabs.
3. Edit, switch tab, reload, close, and restart; references and active tab restore.

- [x] **Step 4: Manually prove Pinned Folders behavior**

Observe:

1. Mode selector switches only after dirty save succeeds and remains selected after restart.
2. Pin task-a and task-b from arbitrary locations; A/B follow pin order.
3. Ignored Markdown does not appear; visible Markdown ancestors appear in a collapsible tree.
4. A and B maintain independent selected folders, expanded folders, tabs, and active documents while the app remains running.
5. Pinned tabs are one-line and there is no Pinned list-header Open File action.
6. Selecting an exact pin activates it; selecting an ancestor/descendant shows the overlap notice without state change.
7. Removing A with tabs asks for confirmation; cancel preserves state; approval removes its session and renumbers B→A.

- [x] **Step 5: Manually prove missing-root recovery**

With task-b pinned and tabs open:

1. Close/save the active file, remove or rename the task-b directory externally, then refresh.
2. Observe the retained shortcut, missing-folder message, refresh, and unpin actions.
3. Recreate the same canonical path and Markdown files, refresh, and observe the stored tab references restore.

- [x] **Step 6: Manually prove cross-mode same-file serialization**

Open the same physical Markdown file once through Open Files and once through Pinned Folders. Edit in one mode, switch modes, and verify the target mode reloads the saved disk content; no two dirty buffers coexist.

- [x] **Step 7: Capture final evidence and stop**

Record concise evidence for:

- automated command exit codes;
- Open Files unchanged;
- Pinned A/B switch and root-local tabs;
- ignored path absence and collapsed/expanded tree;
- missing-root recovery;
- unpin confirmation/cancel/approval;
- Light/Dark and English/Korean at the normal 216px folder pane and narrow responsive layout.

Do not commit or push. Update `../TASK-WORKBRANCH.md` to `status: done` only after this manual gate passes during implementation.

**Verification (2026-08-16):** Final gate passed: Vitest 182/182, Biome 57 files, TypeScript/Vite production build, Rust fmt, Rust tests 17/17, Clippy with warnings denied, and `git diff --check`. A real Tauri build ran against isolated `/private/tmp/intent-memo-ai-modes-1786823194` fixtures and an isolated app identifier. Captures `/tmp/intent-memo-open-files-main.png`, `/tmp/intent-memo-pinned-a-restored.png`, `/tmp/intent-memo-missing-root-localized.png`, `/tmp/intent-memo-restored-live.png`, and `/tmp/intent-memo-open-serialized.png` prove Open Files two-line tabs, Pinned A/B root-local navigation and one-line tabs, ignore-aware collapsed/expanded branches, localized missing-root retention/recovery, and cross-mode disk serialization. Confirmation, cancellation, overlap, exact-pin, save-failure, and unpin fallback paths are covered by the passing integration/component suites.

---

## Current Folder-first revision

### Task 10: Replace file-first settings with root-local Browse and labeled Pinned models

**Files:**
- Modify: `src/types/library.ts`
- Modify: `src/lib/settings.ts`
- Create: `src/lib/settingsParsing.ts`
- Create: `src/lib/docsFolderLabel.ts`
- Create: `src/lib/docsFolderLabel.test.ts`
- Modify: `src/lib/settings.test.ts`
- Modify: `src/lib/i18n.ts`
- Modify: `src/lib/i18n.test.ts`

- [x] Add RED tests for `browse | pinned`, root-local Browse tabs, `{ root, label }` pinned entries, duplicate labels, and legacy Open Files reset.
- [x] Replace `DocsDocumentRef`/global docs session with the root-local `TabSession` used by both AI modes.
- [x] Parse `open-files` and legacy `{ documents, active }` as empty Browse state; preserve valid pinned roots/sessions while mapping `pinned-folders` to `pinned`.
- [x] Add `Browse | Pinned` and `일반 | 고정` copy plus label validation/editing copy.
- [x] Run settings/i18n tests and `pnpm check` on the touched files.

### Task 11: Use one canonical ignore-aware AI folder scanner in both modes

**Files:**
- Modify: `src-tauri/src/library.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/lib/native.ts`
- Modify: `src/hooks/useLibraryWorkspace.ts`
- Modify: `src/hooks/useLibraryWorkspace.test.tsx`

- [x] Add RED tests proving Browse uses the AI scanner and failed initial scan preserves the persisted session.
- [x] Rename the Pinned-only command/adapter to the mode-neutral `scan_docs_root` / `scanDocsRoot` and use it for Browse and Pinned.
- [x] Preserve Human `scan_library`, hidden/symlink policy, `.gitignore`/`.ignore`, and missing-root behavior.
- [x] Run targeted hook tests, Rust tests, fmt, and Clippy.

### Task 12: Add custom pinned labels and edit lifecycle

**Files:**
- Modify: `src/components/NameDialog.tsx`
- Modify: `src/components/NameDialog.test.tsx`
- Modify: `src/components/PinnedRootsSwitcher.tsx`
- Modify: `src/components/PinnedRootsSwitcher.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`

- [x] Add RED tests for basename-derived editable suggestions, 1~2 grapheme validation, duplicate labels, stable labels after unpin, and label-only edits.
- [x] Extend `NameDialog` with an optional typed validation boundary without changing existing file/folder naming behavior.
- [x] Render stored labels instead of generated A/B/C labels and add `Edit label` beside Unpin in the pinned-root menu.
- [x] Pin transaction: choose directory → canonicalize → overlap check → label dialog → save barrier → persist root/label/session.
- [x] Run dialog, switcher, App source-mode tests and Biome.

### Task 13: Build the AI combined file explorer

**Files:**
- Create: `src/components/FileExplorerTree.tsx`
- Create: `src/components/FileExplorerTree.test.tsx`
- Modify: `src/index.css`
- Modify: `DESIGN.md`

- [x] Add RED tests for `[label] basename`, unlabeled Browse root, mixed file/folder ordering, folder select+toggle, file open, keyboard/focus semantics, and ignored branch absence.
- [x] Implement an AI read-only tree over `FolderEntry[]` and `DocumentEntry[]`; do not modify Human `FolderTree`.
- [x] Keep the component below 250 pure LOC and use existing sidebar tokens, indentation, focus ring, and selected-state anatomy.
- [x] Document the `FileExplorerTree` component contract in `DESIGN.md` before product wiring.
- [x] Run component tests, Biome, and production build.

### Task 14: Orchestrate folder-first Browse and Pinned UI

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/components/DocsRootSwitcher.tsx`
- Modify: `src/components/DocsRootSwitcher.test.tsx`
- Modify: `src/components/TabBar.tsx`
- Modify: `src/index.css`

- [x] Add RED App tests for first-entry mode choice, Browse folder picker, no Browse shortcuts, Browse restart restore, Pinned custom shortcuts, global mode switching, and direct-child Document List behavior.
- [x] Replace Open File welcome/actions with directory picker actions in both modes.
- [x] Browse Source Card shows only mode selector, Open Folder action, and current root row; Pinned shows stored labels and Pin Folder.
- [x] Mount `FileExplorerTree` in both AI modes while retaining `Explorer | Document List | Content` and direct-child list filtering.
- [x] Use one-line root-local tabs in both modes and preserve canonical path accessibility data.
- [x] Run the full App/component test slice, Biome, and production build.

### Task 15: Synchronize contracts and run the final gate

**Files:**
- Modify: `CLAUDE.md`
- Modify: `DESIGN.md`
- Modify: `docs/specs/intent-memo.md`
- Modify: `docs/plans/2026-08-15-ai-pinned-roots.md`
- Modify: `docs/plans/2026-08-16-ai-source-modes-implementation.md`
- Verify: all changed implementation files

- [x] Replace stale Open Files/A-B-C wording with folder-first Browse/Pinned, custom label, combined explorer, and legacy reset contracts.
- [x] Run `pnpm test`, `pnpm check`, `pnpm build`, Rust fmt/test/Clippy, and `git diff --check`.
- [x] Run the real Tauri app with isolated Browse and duplicate-label Pinned fixtures.
- [x] Observe: first mode choice, folder-only pickers, Browse restore/replace, duplicate custom labels, label edit, `[label] basename` explorer, inline folder expansion, file open, direct-child middle list, mode/root save barriers, missing-root recovery, English/Korean, Light/Dark, and narrow layout.
- [x] Record evidence in this Task and set `../TASK-WORKBRANCH.md` to `done`. Do not commit or push.


**Folder-first verification (2026-08-16):** Vitest 160/160, Biome 62 files, TypeScript/Vite production build, Rust fmt, Rust tests 17/17, Clippy with warnings denied, and `git diff --check` passed. A production Tauri `.app` used isolated bundle identifier `app.tkbetter.intentmemo.folderqa1786852011` and fixtures under `/private/tmp/intent-memo-folderqa-1786852011`; the temporary build config was restored before closeout. Captures `/tmp/intent-memo-folderqa-choice.png`, `/tmp/intent-memo-folderqa-browse.png`, `/tmp/intent-memo-folderqa-browse-notes.png`, `/tmp/intent-memo-folderqa-pinned.png`, `/tmp/intent-memo-folderqa-pinned-menu.png`, `/tmp/intent-memo-folderqa-pinned-narrow.png`, `/tmp/intent-memo-folderqa-missing.png`, and `/tmp/intent-memo-folderqa-restored.png` prove the explicit mode choice and folder-only action, shortcut-free Browse root-local tabs, combined Explorer with inline expansion and direct-child middle list, duplicate custom labels plus edit/unpin controls, `[QA] pin-one`, English Light and Korean Dark, 760px narrow layout, and retained/recovered missing root. Browse replacement, label-edit persistence, file activation, and save-barrier failure paths are covered by the passing App/component/hook tests. The installed production app was reopened after isolated QA. No commit or push was performed.
