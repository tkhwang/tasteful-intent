<p align="center">English | <a href="./README.ko.md">한국어</a></p>

<p align="center">
  <picture>
    <source media="(max-width: 600px)" srcset="./assets/readme/hero-en-mobile.svg">
    <img src="./assets/readme/hero-en.svg" width="100%" alt="Tasteful Intent, a local Markdown app with separate Human and AI workspaces">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/tkhwang/tasteful-intent/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/tkhwang/tasteful-intent/ci.yml?branch=main&style=flat-square&label=CI&color=C1734B" alt="CI status"></a>
  <a href="https://github.com/tkhwang/tasteful-intent/releases"><img src="https://img.shields.io/github/v/release/tkhwang/tasteful-intent?sort=semver&amp;style=flat-square&amp;color=C1734B" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/macOS-322F29?style=flat-square&logo=apple&logoColor=F4EEE2" alt="macOS">
  <img src="https://img.shields.io/badge/local-Markdown-5878A0?style=flat-square" alt="Local Markdown files">
</p>

<p align="center">
  Write the intent in your own words. Keep it as local Markdown.<br>
  Open what AI makes in a separate workspace without replacing the original.
</p>

## From intent to result

Prompts change from one request to the next. Your intent and taste last longer. Tasteful Intent keeps that source in a Human workspace and lets you inspect AI-created Markdown in a separate AI workspace.

<p align="center">
  <picture>
    <source media="(max-width: 600px)" srcset="./assets/readme/original-first-en-mobile.svg">
    <img src="./assets/readme/original-first-en.svg" width="100%" alt="Your intent becomes a local Markdown original that you use with AI before opening the resulting folders separately">
  </picture>
</p>

The app does not run an LLM or copy your notes into its own database. It works directly with the folders you select.

## Quick start

Install the signed macOS app with Homebrew:

```bash
brew install --cask tkhwang/tap/tasteful-intent
```

Open the app, choose the language and appearance, then connect a folder for your Human notes. When you enter AI for the first time, choose a folder that contains AI-created Markdown.

Apple silicon and Intel DMGs are also available on the [Releases page](https://github.com/tkhwang/tasteful-intent/releases).

## What you can do

- Write Human notes with CodeMirror 6, GFM rendering, 500 ms autosave, atomic writes, and external-change protection.
- Open multiple AI folders as tabs. Pin frequent roots with a one- or two-character label and restore each folder's document session.
- Keep several documents open and move each one through `Edit → View → Split`. Human documents start in Edit; AI documents start in View.
- Find text in the current document with `⌘F` or `Ctrl+F`, including highlighted matches in Edit, View, and Split.
- Render root-relative local images up to 10 MiB and export the current rendered document as a PDF.
- Sort by latest update or title and switch the document list between Full, Medium, and Simple density.
- Create, rename, move, and send Human files or folders to the system Trash through keyboard-accessible context menus.
- Work in three panes, two panes, or content-only mode. The app includes English and Korean UI, four themes, four Human/AI color palettes, and two writing typefaces.

AI folders allow Markdown editing but not structural file operations. Workspace-wide search, tags, a Markdown toolbar, attachment management, wiki/backlinks, sync, accounts, and a built-in LLM runtime are outside the current scope.

## Local by design

The filename is the document title. Tasteful Intent canonicalizes every selected root, keeps file operations inside that boundary, skips hidden paths and symlinks, and respects `.gitignore` and `.ignore` while scanning AI folders.

Closing an AI folder tab changes only app settings. It never deletes the folder or its files. Human deletion uses the macOS Trash instead of permanent removal. Settings live in the OS app-data directory for bundle ID `app.tkbetter.intentmemo`.

<details>
<summary>New Human document format</summary>

New documents contain only `created` and `updated` timestamps plus an empty body:

```markdown
---
created: 2026-08-02T00:00:00.000Z
updated: 2026-08-02T00:00:00.000Z
---
```

</details>

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Find in the current document | `⌘F` or `Ctrl+F` |
| Toggle the folder pane | `⌘1` |
| Toggle content-only mode | `⌘2` |

## Development

Requires Node.js 20+, pnpm, Rust, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm tauri:dev
```

Run the repository checks before submitting a change:

```bash
pnpm check
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
pnpm tauri:build
```

`pnpm check` does not modify files. Run `pnpm biome check --write .` when you intend to format them.

## Stack

Tauri 2 and Rust power the desktop shell and filesystem boundary. The interface uses React 19, TypeScript, CodeMirror 6, react-markdown, remark-gfm, Biome, and Vitest.

<details>
<summary>Release automation</summary>

Release Please manages versions and the changelog. Conventional commits merged into `main` open or update a release PR. Merging that PR publishes a `v*` GitHub release, builds signed and notarized macOS DMGs for Apple silicon and Intel, attaches updater artifacts, and updates `tkhwang/homebrew-tap` with the rendered cask and checksums.

The workflow uses `RELEASE_PLEASE_TOKEN` for the release PR, Apple and Tauri signing secrets for desktop artifacts, and `TAP_GITHUB_TOKEN` for the Homebrew tap.

</details>
