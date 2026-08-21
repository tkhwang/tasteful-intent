# CLAUDE.md

## Product Contract

Tasteful Intent is a greenfield Tauri desktop Markdown editor for human-authored intentions. The selected `libraryRoot` remains canonical Intent source data. AI keeps one ordered list of user-selected canonical folder tabs with one root-local session per tab; pinning is a tab property represented by an optional 1-2 grapheme label, not a separate source mode. AI edits content through the shared Edit, View, and Split modes and the existing atomic-save/mtime-conflict boundary; AI file/folder creation, rename, move, and Trash remain unavailable. AI View adds a read-only git-diff view cycle (changes-only with collapsed context → full document with highlighted changes → off) that compares the active document body against its git HEAD baseline; it never runs mutating git commands and hides itself when git or a repository is unavailable. Do not add migration adapters for the former PromptPad product. LLM runtime, tags, toolbar, and wiki features are outside v0.2.

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

The filesystem is the database. Filenames are document titles. Frontmatter contains only immutable `created` and save-updated `updated`. Native writes use a same-directory temporary file and mtime conflict detection. Human paths remain canonicalized inside `libraryRoot`; AI accepts arbitrary user-selected canonical visible directories and scans Markdown-bearing branches with standard `.gitignore` and `.ignore` rules. Exact duplicate roots activate the existing tab, while ancestor/descendant roots are allowed. Hidden paths and symlink traversal stay excluded. Human delete actions use system Trash.

## UI Contract

- Three panes: folders, documents, content, with user-facing `Human | AI` space switching (`intent`/`docs` internal keys remain unchanged).
- Clean settings use `settingsSchemaVersion: 2`, leave `libraryRoot` and `docsRoot` unset with `docsRoots: []`, and use English UI, Sans-serif writing typography, and the Classic Human/AI color palette. A three-step `language → theme + Human/AI colors → Human folder` onboarding runs while Human root is missing. First AI entry offers one AI folder picker. Human opens in Edit and AI opens in View; both support `Edit → View → Split(Edit | View)`, while AI structural file/folder management remains unavailable.
- The content pane has one top row: an icon-only pane control, scrollable per-space tabs, a Human/AI current-document `RefreshCw`, transient save status, an AI-only View-mode diff cycle control (hidden when no git baseline is available), and a far-right mode control; no second header. Reload saves a dirty active document first, then reads only that `{ root, path }` from disk. Save/read failure keeps the current buffer and tab.
- The macOS overlay titlebar keeps native traffic lights, shows `Tasteful Intent` at the left, and centers the active document title over the whole window. It contains no document actions.
- Rename, move, and Trash live in keyboard-accessible document/folder context menus.
- Each content-pane tab has a keyboard-accessible context menu with `Close tab`, `Close other tabs`, `Close tabs to the right`, and `Close all tabs`. Actions with no target are omitted, every close goes through the same save barrier as the tab close button, and the first save failure stops the remaining closes.
- The shared create/rename NameDialog submits a valid single-line name through the same form path for Enter and its primary button. Blank, in-flight, and IME-composition Enter states do not submit; Escape still cancels.
- Human/AI switching lives only in the navigation sidebar: the folder pane owns it in three-pane mode, and the document-list pane provides the single fallback when folders are collapsed in two-pane mode. The writing surface and content-only mode do not repeat the current space.
- An icon-only pane button immediately before the tabs cycles three panes, two panes, and content-only. The folder pane alone owns the active root display and folder picker; `⌘1` remains a keyboard return path but is not shown as a badge on the switcher.
- The folder tree root and root move destination use the selected directory basename; never present a hardcoded `Library` default.
- Human keeps its fixed-height 78px two-row Source Card below the space switcher. AI uses a compact pinned-shortcut header followed by a vertically scrollable list of every open root. Each visible path keeps only its final two segments as `…/parent/leaf`; pinned list rows prefix the path with their label, while the header repeats only pinned labels as shortcuts. Every path row exposes a direct `Pin` toggle: unpinned is muted but enabled, pinned uses the current AI accent; pinning opens the existing label input before activation and clicking an active pin immediately unpins. The ellipsis menu contains only `Edit label` for pinned roots or `Close` for unpinned roots, plus targeted `Refresh` when unavailable. Pin moves a tab to the end of the pinned group, Unpin moves it to the front of the unpinned group without removing its session, and Edit label preserves root/session identity. Only unpinned tabs can close, removing that root-local session without touching disk files. Exact duplicate roots activate the existing tab; arbitrary visible non-symlink canonical roots, including ancestor/descendant pairs, are allowed. Root activation and close use the save barrier, while pin, unpin, and label edits only persist list transformations. The two-pane navigation fallback retains the AI controls; content-only does not.
- AI uses root-local one-line document tabs without a source badge; tooltip and accessible name retain the canonical full path. The AI rendered view opens with a muted fixed-font `…/parent/file.md` document-path line above the body that scrolls with the content, keeps the canonical full path as tooltip, and ends with the document's on-disk modified time so reloads make file updates visible; Human mode and PDF export omit it. The AI Explorer mixes folders and Markdown files under the selected root; folder activation selects and expands/collapses the branch, while file activation opens a tab and selects its parent folder. Restoring an active AI session applies the same parent-folder selection. The middle Document List shows only direct Markdown children of the selected folder, marks the active document selected, and keeps that row visible after document, snippet, density, or pane-size changes without moving focus. Folder selection, expanded-tree state, and root availability are runtime-only per root. A missing root keeps its folder tab, optional label, and saved session; targeted Refresh activates it only after a successful scan.
- `⌘1` toggles folders while the list is visible; `⌘2` toggles list plus folders.
- `⌘F` and `Ctrl+F` open a non-modal current-document Find overlay when an active document exists. Search is case-insensitive literal matching over the current Markdown body only; Enter/Shift+Enter and the next/previous buttons wrap through results, while Escape closes the overlay and restores the prior focus. Human/AI Edit/View/Split reflect the same active result without persisting search state or scanning the workspace.
- The document list has a global `documentDensity` shared by Human and AI and persisted in `settings.json`: Full shows title, up to two snippet lines, and updated date; Medium shows title and one snippet line; Simple shows title only. Its header cycles `Full → Medium → Simple → Full` with `Rows4`/`Rows3`/`Rows2` between the latest/title sort toggle and create. Human uses `Refresh → Sort → Density → Create`; AI always uses `Refresh → Sort → Density → Open Folder`, regardless of pin state. Folder rows have no numeric counts. The global `documentSort` preference remains shared by Human and AI and persisted.
- Settings has separate Appearance, Typography, and Language navigation. Appearance offers Light (default), Two-Tone, Dark, and System themes plus Classic, Terracotta & Teal, Plum & Moss, and Mono Duo Human/AI color palettes in independent 2×2 radio-tile groups; both choices apply immediately and persist independently. The persisted Two-Tone key remains `charcoal`, System follows the OS color mode, and the default palette key is `classic`. Typography offers Sans-serif (default) and Serif in 2-column cards with a live preview; it applies only to Markdown editing/reading and large empty-state copy while application chrome remains Sans-serif. Language offers English (default) and 한국어 in the same 2-column card pattern with a localized live preview, applies immediately across application chrome, and persists in `settings.json`. User filenames, folder names, Markdown titles, and Markdown bodies are never translated. The visible Settings button lives at the navigation bottom: folder pane in three-pane mode, document-list pane in two-pane mode, and nowhere in content-only mode. Settings has no keyboard shortcut.
- Reuse tokens and primitives from `DESIGN.md`. The development showcase is `?showcase=1`.

## Change Rules

- Keep diffs small; add no dependencies without explicit authorization.
- Run targeted tests, then `pnpm check`, `pnpm build`, Rust format/clippy/tests, and a real Tauri smoke test.
- Do not create commits or push. The user handles Git operations.
