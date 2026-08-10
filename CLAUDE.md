# CLAUDE.md

## Product Contract

Tasteful Intent is a greenfield Tauri desktop Markdown editor for human-authored intentions. The selected `libraryRoot` remains canonical Intent source data. AI is read-only: an OS-opened Markdown file contributes its canonical parent as the document source, while `docsRoot` is only the active document projection. Do not add migration adapters for the former PromptPad product. LLM runtime, user-managed AI folder registration, search, tags, toolbar, images, and wiki features are outside v0.2.

Read `docs/specs/intent-memo.md` and `DESIGN.md` before changing product behavior or UI.

## Commands

```bash
pnpm tauri:dev       # Vite + native desktop app
pnpm build           # TypeScript build + production web bundle
pnpm check           # non-mutating Biome check
pnpm test            # Vitest
pnpm tauri:build     # production desktop bundle
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

## Architecture

```text
src/
├── App.tsx                         # onboarding + 3-pane workspace orchestration
├── components/                     # folder, document, editor, view, space/tab/menu primitives, dialogs
├── hooks/useLibraryWorkspace.ts    # workspace state and autosave boundary
├── lib/markdown.ts                 # canonical frontmatter parse/serialize
├── lib/native.ts                   # validated Tauri IPC adapter
└── lib/settings.ts                 # roots + active space/tab + pane layout persistence
src-tauri/src/
├── lib.rs                          # Tauri plugins and command registration
└── library.rs                      # recursive filesystem model and safety rules
```

The filesystem is the database. Filenames are document titles. Frontmatter contains only immutable `created` and save-updated `updated`. Native writes use a same-directory temporary file and mtime conflict detection. Human paths remain canonicalized inside `libraryRoot`; AI Open File resolves a canonical regular Markdown file into `{ root: parent, path: filename }`. Hidden paths and symlink traversal stay excluded. Human delete actions use system Trash.

## UI Contract

- Three panes: folders, documents, content, with user-facing `Human | AI` space switching (`intent`/`docs` internal keys remain unchanged).
- Clean settings leave `libraryRoot` and `docsRoot` unset, use English UI, and use Sans-serif writing typography by default. A three-step `language → theme → Human folder` onboarding runs while Human root is missing. Language and theme apply immediately and Human folder is required. AI has no folder setup step; its welcome opens a Markdown file. Human supports `Edit → View → Split(Edit | View)` while AI remains read-only View.
- The content pane has one top row: an icon-only pane control, scrollable per-space tabs, save status, and a far-right icon-only mode control; no second header.
- The macOS overlay titlebar keeps native traffic lights, shows `Tasteful Intent` at the left, and centers the active document title over the whole window. It contains no document actions.
- Rename, move, and Trash live in keyboard-accessible document/folder context menus.
- The shared create/rename NameDialog submits a valid single-line name through the same form path for Enter and its primary button. Blank, in-flight, and IME-composition Enter states do not submit; Escape still cancels.
- Human/AI switching lives only in the navigation sidebar: the folder pane owns it in three-pane mode, and the document-list pane provides the single fallback when folders are collapsed in two-pane mode. The writing surface and content-only mode do not repeat the current space.
- An icon-only pane button immediately before the tabs cycles three panes, two panes, and content-only. The folder pane alone owns the active root display and folder picker; `⌘1` remains a keyboard return path but is not shown as a badge on the switcher.
- The folder tree root and root move destination use the selected directory basename; never present a hardcoded `Library` default.
- Human and AI share a fixed-height two-row Source Card below the space switcher so the card and folder tree do not move vertically during space changes. Human shows the static workspace label `Tasteful Intent Library` above `Folder | path | ChevronRight`. AI shows the always-visible 30px square `A | B | C` shortcuts and a 30px `FilePlus2` Open File action above `active letter | canonical file path | ChevronDown`; its path is derived from the active open file. Expanding it overlays a dropdown below the card, with the same letter, trailing-aligned parent folder, tail-visible full canonical file path, active check, and close control. Dropdown and letter selection activate the same connected document and derive the base path and second pane from it. The `FilePlus2` action opens another Markdown file and never registers a folder. A successful dropdown close keeps the menu open and restores focus to the active remaining row; closing the last document returns to AI welcome. There is no folder add/remove UI. The two-pane navigation fallback retains the AI controls; content-only does not.
- Every AI tab uses two lines: a compact source-letter badge followed by the title, then muted `root basename / relative parent folder` without repeating the filename. The badge and Source Card shortcut derive from the same open-document order, are re-numbered together after close, and are never persisted identity. Human tabs remain one line without a badge. Full AI paths stay in tooltip and accessible copy, which includes the source letter.
- `⌘1` toggles folders while the list is visible; `⌘2` toggles list plus folders.
- The document list has a global `documentDensity` shared by Human and AI and persisted in `settings.json`: Full shows title, up to two snippet lines, and updated date; Medium shows title and one snippet line; Simple shows title only. Its header cycles `Full → Medium → Simple → Full` with `Rows4`/`Rows3`/`Rows2` between the latest/title sort toggle and create, so the order is `Refresh → Sort → Density → Create`. Folder rows have no numeric counts. The global `documentSort` preference remains shared by Human and AI and persisted.
- Settings has separate Appearance, Typography, and Language navigation. Appearance offers Light (default), Two-Tone, Dark, and System themes in 2×2 radio tiles; the persisted Two-Tone key remains `charcoal`, and System follows the OS color mode. Typography offers Sans-serif (default) and Serif in 2-column cards with a live preview; it applies only to Markdown editing/reading and large empty-state copy while application chrome remains Sans-serif. Language offers English (default) and 한국어 in the same 2-column card pattern with a localized live preview, applies immediately across application chrome, and persists in `settings.json`. User filenames, folder names, Markdown titles, and Markdown bodies are never translated. The visible Settings button lives at the navigation bottom: folder pane in three-pane mode, document-list pane in two-pane mode, and nowhere in content-only mode. Settings has no keyboard shortcut.
- Reuse tokens and primitives from `DESIGN.md`. The development showcase is `?showcase=1`.

## Change Rules

- Keep diffs small; add no dependencies without explicit authorization.
- Run targeted tests, then `pnpm check`, `pnpm build`, Rust format/clippy/tests, and a real Tauri smoke test.
- Do not create commits or push. The user handles Git operations.
