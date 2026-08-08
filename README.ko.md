<p align="center"><a href="./README.md">English</a> | 한글</p>

<p align="center">
  <img src="https://img.shields.io/badge/v0.2.0-C1734B?style=flat-square" alt="v0.2.0">
  <img src="https://img.shields.io/badge/macOS-322F29?style=flat-square&logo=apple&logoColor=F4EEE2" alt="macOS">
  <img src="https://img.shields.io/badge/Tauri_2-322F29?style=flat-square&logo=tauri&logoColor=F4EEE2" alt="Tauri 2">
  <img src="https://img.shields.io/badge/React_19-322F29?style=flat-square&logo=react&logoColor=F4EEE2" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-322F29?style=flat-square&logo=typescript&logoColor=F4EEE2" alt="TypeScript">
  <img src="https://img.shields.io/badge/Rust-322F29?style=flat-square&logo=rust&logoColor=F4EEE2" alt="Rust">
  <img src="https://img.shields.io/badge/CodeMirror_6-322F29?style=flat-square&logo=codemirror&logoColor=F4EEE2" alt="CodeMirror 6">
</p>

<p align="center">
  <img src="./assets/readme/hero-ko.svg" width="100%" alt="Tasteful Intent(취향 담은 의도) — 나의 의도와 취향을 기록해 AI에 전달하고, AI가 만든 결과를 확인하는 미니멀 Markdown 메모 앱. Human → AI 공간 switcher와 폴더, 문서 목록, 본문으로 구성된 3-pane workspace.">
</p>



**Tasteful Intent(취향 담은 의도)** 는 나의 생각과 만들고 싶은 것, 원하는 스타일을 기록해 AI에 전달하고, AI가 만든 결과를 확인하는 미니멀 Markdown 데스크톱 앱입니다. 선택한 폴더의 Markdown 파일이 모든 결과의 원천이며, 앱은 그 원천을 쓰고 읽고 관리하는 데 집중합니다.

## 왜 prompt가 아니라 의도인가

나의 의도와 취향을 AI에 전하면 AI는 그에 맞는 결과를 만듭니다. Tasteful Intent는 모든 결과의 출발점인 의도와 취향을 기록하고 관리하는 데 집중합니다.

<p align="center">
  <img src="./assets/readme/original-first-ko.svg" width="100%" alt="나의 생각과 의도를 직접 기록하면 내가 소유한 로컬 Markdown 원본이 되고, AI 기능은 후속 버전에서 원본을 대체하지 않는 파생 계층으로만 추가됩니다.">
</p>

- Markdown editor 기본 기능에서 출발합니다: 빠르고 안전한 작성, 자동 저장, 사용자가 소유하는 로컬 원본.
- 그 위에 목적, 배경, 제약, 완료 조건처럼 의도를 구체화하는 데 필요한 작성 편의 기능을 단계적으로 더합니다.
- AI 기능은 인간이 작성한 원본을 대체하지 않는 파생 계층으로만 후속 버전에서 검토합니다.

## v0.2

- 내가 직접 쓰는 의도를 담는 **Human**과 그 의도로 AI가 만든 결과를 읽는 **AI** 두 Markdown 공간
- 공간별 독립 로컬 root, sidebar 상단에 항상 보이는 `Human → AI` switcher — 3-pane에서는 folder pane, folder pane을 접은 2-pane에서는 문서 목록 위
- 여러 문서를 여는 tab, 공간별 session 복원, tab별 `Edit → View → Split(Edit | View)` 순환 — Human은 Edit, AI는 View로 시작
- 문서·폴더 생성, 이름 변경, 이동, 시스템 휴지통 이동
- 이름 변경·이동·휴지통 동작을 제공하는 keyboard 접근 가능 context menu
- CodeMirror 6 Markdown syntax highlighting
- 문서별 500ms autosave, atomic write, 외부 변경 충돌 보호, 공간 전환·앱 종료 전 save barrier
- `⌘1` 폴더 pane, `⌘2` content-only 전환
- 영어 기본·한국어 선택 UI와 Light · Two-Tone · Dark · System 테마, Sans-serif·Serif 글쓰기 typography. application chrome은 Sans-serif로 고정하고 Typography는 Markdown 편집·보기와 큰 빈 화면 문구에만 적용

검색, tags, Markdown toolbar, 이미지, wiki/backlink, LLM runtime과 AI 관리 폴더는 후속 범위입니다.

## Install

```bash
brew install --cask tkhwang/tap/tasteful-intent
```

또는 [Releases](https://github.com/tkhwang/tasteful-intent/releases)에서 서명된 `.dmg`를 직접 내려받아 설치합니다.

## Data

첫 실행에서 Human 공간의 `libraryRoot`를 선택하고, AI 공간에 처음 진입할 때 별도 `docsRoot`를 선택합니다. 파일명은 제목의 source of truth이며, 새 문서는 최소 frontmatter와 빈 본문으로 시작합니다.

```markdown
---
created: 2026-08-02T00:00:00.000Z
updated: 2026-08-02T00:00:00.000Z
---
```

숨김 경로와 symlink는 탐색하지 않습니다. 삭제는 영구 삭제 대신 운영체제 휴지통을 사용합니다. 설정은 bundle ID `app.tkbetter.intentmemo`의 OS app-data 위치에 `settings.json`으로 저장됩니다.

## Development

Prerequisites: Node.js 18+, pnpm, Rust, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm tauri:dev
```

```bash
pnpm check
pnpm test
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
pnpm tauri:build
```

`pnpm check` is non-mutating. Use `pnpm biome check --write .` when formatting is intended.

## Release

릴리스는 release-please로 자동화되어 있습니다. conventional commit이 `main`에 merge되면 release PR이 열리고(또는 갱신되고), 이 PR이 `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` 버전과 changelog를 관리합니다. release PR을 merge하면 `v*` GitHub 릴리스가 publish되고, 서명된 macOS DMG를 빌드해 릴리스에 업로드한 뒤 `distribution/homebrew/tasteful-intent.rb`를 checksum과 함께 렌더링해 `tkhwang/homebrew-tap`에 반영합니다.

자동화에는 repo secret 두 개가 필요합니다: `RELEASE_PLEASE_TOKEN`(이 repo의 Contents·Pull requests·Issues write)과 `TAP_GITHUB_TOKEN`(tap의 Contents write).

## Stack

- Tauri 2 / Rust
- React 19 / TypeScript
- CodeMirror 6
- react-markdown + remark-gfm
- Biome / Vitest
