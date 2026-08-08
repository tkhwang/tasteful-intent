# CLAUDE.md

## Product Contract

Tasteful Intent is a greenfield Tauri desktop Markdown editor for human-authored intentions. The selected `libraryRoot` remains canonical Intent source data; optional `docsRoot` is a separate user-selected read-write reference-document space. Do not add migration adapters for the former PromptPad product. LLM runtime, automatically managed AI folders, search, tags, toolbar, images, and wiki features are outside v0.2.

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

The filesystem is the database. Filenames are document titles. Frontmatter contains only immutable `created` and save-updated `updated`. Native writes use a same-directory temporary file and mtime conflict detection. All paths must remain canonicalized inside the active root (`libraryRoot` or `docsRoot`); hidden paths and symlink traversal stay excluded. Delete actions use system Trash.

## UI Contract

- Three panes: folders, documents, content, with user-facing `Human | AI` space switching (`intent`/`docs` internal keys remain unchanged).
- Clean settings leave both `libraryRoot` and `docsRoot` unset, use English UI, and use Sans-serif writing typography by default. Onboarding lets the user choose Human or AI first, then select only that space's folder. Both roots are independently persisted, while both spaces support read-write operation and cycle `Edit → View → Split(Edit | View)`; Human opens in Edit and AI in View.
- The content pane has one top row: an icon-only pane control, scrollable per-space tabs, save status, and a far-right icon-only mode control; no second header.
- The macOS overlay titlebar keeps native traffic lights, shows `Tasteful Intent` at the left, and centers the active document title over the whole window. It contains no document actions.
- Rename, move, and Trash live in keyboard-accessible document/folder context menus.
- Human/AI switching lives only in the navigation sidebar: the folder pane owns it in three-pane mode, and the document-list pane provides the single fallback when folders are collapsed in two-pane mode. The writing surface and content-only mode do not repeat the current space.
- An icon-only pane button immediately before the tabs cycles three panes, two panes, and content-only. The folder pane alone owns the active root display and folder picker; `⌘1` remains a keyboard return path but is not shown as a badge on the switcher.
- The folder tree root and root move destination use the selected directory basename; never present a hardcoded `Library` default.
- The folder pane shows the active space's Markdown root as one compact `Folder | path | ChevronRight` button below the space switcher; its full row opens the folder picker and its accessible name explains the current path and change action. Do not repeat it in two-pane or content-only mode.
- `⌘1` toggles folders while the list is visible; `⌘2` toggles list plus folders.
- The document list uses content-height rows with title, up to two snippet lines, and updated date; folder rows have no numeric counts.
- Settings has separate Appearance, Typography, and Language navigation. Appearance offers Light (default), Two-Tone, Dark, and System themes in 2×2 radio tiles; the persisted Two-Tone key remains `charcoal`, and System follows the OS color mode. Typography offers Sans-serif (default) and Serif in 2-column cards with a live preview; it applies only to Markdown editing/reading and large empty-state copy while application chrome remains Sans-serif. Language offers English (default) and 한국어 in the same 2-column card pattern with a localized live preview, applies immediately across application chrome, and persists in `settings.json`. User filenames, folder names, Markdown titles, and Markdown bodies are never translated. The visible Settings button lives at the navigation bottom: folder pane in three-pane mode, document-list pane in two-pane mode, and nowhere in content-only mode. Settings has no keyboard shortcut.
- Reuse tokens and primitives from `DESIGN.md`. The development showcase is `?showcase=1`.

## Change Rules

- Keep diffs small; add no dependencies without explicit authorization.
- Run targeted tests, then `pnpm check`, `pnpm build`, Rust format/clippy/tests, and a real Tauri smoke test.
- Do not create commits or push. The user handles Git operations.
