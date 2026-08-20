# AI View Diff Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** AI space의 View 모드에서 활성 문서의 git HEAD 대비 변경 사항을 read-only unified diff로 표시한다.

**Architecture:** Rust에 read-only `read_document_baseline` command를 추가해 `git` CLI로 HEAD 시점 파일 내용을 가져온다(Cargo 의존성 추가 없음). 프런트엔드는 AI space에서 문서 활성화 시 baseline을 미리 조회해 두고, View 모드 헤더의 diff 토글이 켜지면 `MarkdownView` 대신 `@codemirror/merge`의 `unifiedMergeView` 기반 read-only `DocumentDiffView`를 렌더한다. baseline과 현재 버퍼 모두 `parseMarkdown`으로 body만 비교해 frontmatter `updated` 노이즈를 제거한다.

**Tech Stack:** Tauri 2 (Rust `std::process::Command`), React 19, CodeMirror 6 + `@codemirror/merge` 6.12.2 (신규 의존성, 사용자 승인됨), zod, Vitest, cargo test.

**Spec:** 별도 spec 문서 없음 — 아래 "요구사항과 결정"이 이 계획의 spec이며, 제품 계약은 `CLAUDE.md`를 따른다.

## 요구사항과 결정 (spec)

- AI space(`activeSpace === "docs"`)의 View 모드에서만 diff를 제공한다. Human space에는 어떤 UI도 노출하지 않는다.
- baseline은 git HEAD다. 앱은 스냅샷 상태를 보관하지 않는다.
- diff는 현재 편집 버퍼(body)와 HEAD body의 비교다. 디스크 저장 여부와 무관하게 버퍼가 진실이다.
- untracked 문서(HEAD에 없음, unborn HEAD 포함)는 전체-추가 diff로 표시한다(baseline = 빈 문자열).
- git이 없거나, repo가 아니거나, 조회에 실패하면 diff 토글 자체를 숨긴다(우아한 퇴화).
- 변경이 없으면 diff surface에 "변경 없음" 안내를 보여준다.
- git 호출은 read-only뿐이다. `git add`/`commit` 등 mutation 명령은 어떤 경우에도 금지.
- 기존 `EDITOR_MODES`(edit/view/split) 계약은 변경하지 않는다. diff는 별도 토글이다.

## Global Constraints

- 신규 의존성은 `@codemirror/merge` 하나만 허용(사용자 승인됨). exact version으로 고정한다(repo는 package.json에 `6.12.2` 형태로 기록).
- **커밋/푸시 금지.** git 작업은 사용자가 직접 수행한다(`CLAUDE.md` Change Rules). 각 Task는 검증 단계로 끝난다.
- i18n은 English + 한국어 모두 갱신한다(`src/lib/i18n.ts`). 사용자 파일명/제목/본문은 번역하지 않는다.
- 테마: `:root` 토큰 + `[data-theme="charcoal"]`/`[data-theme="dark"]` override 패턴을 따른다(`src/index.css`).
- 검증 게이트: `pnpm test`, `pnpm check`, `pnpm build`, `cargo fmt --check`, `cargo test`, `cargo clippy -D warnings`, 실제 `pnpm tauri:dev` smoke test.
- Biome 규칙: 기존 코드처럼 props/객체 키는 알파벳 정렬 경향을 따르고, `pnpm check`로 확인한다.

---

### Task 1: Rust `read_document_baseline` command

**Files:**
- Modify: `src-tauri/src/library.rs` (command + helper + tests)
- Modify: `src-tauri/src/lib.rs:6-22` (command 등록)

**Interfaces:**
- Produces: Tauri command `read_document_baseline(root: String, path: String) -> CommandResult<DocumentBaseline>` — JSON `{ status: "baseline" | "untracked" | "unavailable", content: string | null }` (camelCase serialize).
- Consumes: 기존 helpers `canonical_root`(library.rs:565), `resolve_existing`(:762), `ensure_markdown_file`(:804), `relative_string`(:908).

- [ ] **Step 1: 실패하는 Rust 테스트 작성**

`src-tauri/src/library.rs`의 `mod tests`에 추가. 기존 테스트처럼 `tempfile::tempdir` 사용. git이 test 환경에 없으면 조용히 통과하도록 가드한다.

```rust
fn git_available() -> bool {
    std::process::Command::new("git")
        .arg("--version")
        .output()
        .is_ok_and(|output| output.status.success())
}

fn run_git(root: &Path, args: &[&str]) {
    let status = std::process::Command::new("git")
        .arg("-C")
        .arg(root)
        .args(args)
        .status()
        .expect("git command should run");
    assert!(status.success(), "git {args:?} failed");
}

#[test]
fn reads_head_baseline_for_a_committed_document() {
    if !git_available() {
        return;
    }
    let directory = tempdir().expect("temp dir");
    let root = directory.path().canonicalize().expect("canonical root");
    fs::write(root.join("note.md"), "before\n").expect("write");
    run_git(&root, &["init", "--quiet"]);
    run_git(&root, &["-c", "user.email=t@t", "-c", "user.name=t", "add", "."]);
    run_git(
        &root,
        &["-c", "user.email=t@t", "-c", "user.name=t", "commit", "--quiet", "-m", "seed"],
    );
    fs::write(root.join("note.md"), "after\n").expect("rewrite");

    let baseline = read_document_baseline(
        root.to_str().expect("utf-8 root").to_owned(),
        "note.md".to_owned(),
    )
    .expect("baseline result");

    assert_eq!(baseline.status, "baseline");
    assert_eq!(baseline.content.as_deref(), Some("before\n"));
}

#[test]
fn reports_untracked_for_a_document_missing_from_head() {
    if !git_available() {
        return;
    }
    let directory = tempdir().expect("temp dir");
    let root = directory.path().canonicalize().expect("canonical root");
    run_git(&root, &["init", "--quiet"]);
    fs::write(root.join("new.md"), "fresh\n").expect("write");

    let baseline = read_document_baseline(
        root.to_str().expect("utf-8 root").to_owned(),
        "new.md".to_owned(),
    )
    .expect("baseline result");

    assert_eq!(baseline.status, "untracked");
    assert_eq!(baseline.content, None);
}

#[test]
fn reports_unavailable_outside_a_git_repository() {
    let directory = tempdir().expect("temp dir");
    let root = directory.path().canonicalize().expect("canonical root");
    fs::write(root.join("plain.md"), "text\n").expect("write");

    let baseline = read_document_baseline(
        root.to_str().expect("utf-8 root").to_owned(),
        "plain.md".to_owned(),
    )
    .expect("baseline result");

    assert_eq!(baseline.status, "unavailable");
}
```

`mod tests`의 `use super::{...}`에 `read_document_baseline` 추가. macOS 테스트 환경 주의: tempdir는 `/var/...` symlink 아래일 수 있으므로 위처럼 `canonicalize()`한 경로를 사용한다(기존 테스트들과 동일한 주의점).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml read_document_baseline`
Expected: 컴파일 에러 — `read_document_baseline` 미정의.

- [ ] **Step 3: command 구현**

`library.rs` 상단 struct 구역(기존 `DocumentPayload` 근처, :53 부근)에 추가:

```rust
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentBaseline {
    pub status: String,
    pub content: Option<String>,
}
```

command와 helper(기존 `read_document`(:211) 아래):

```rust
#[tauri::command]
pub fn read_document_baseline(root: String, path: String) -> CommandResult<DocumentBaseline> {
    let canonical_root = canonical_root(Path::new(&root))?;
    let target = resolve_existing(&canonical_root, Path::new(&path), false)?;
    ensure_markdown_file(&target)?;
    let relative = relative_string(&canonical_root, &target)?;
    Ok(git_head_baseline(&canonical_root, &relative))
}

fn baseline_unavailable() -> DocumentBaseline {
    DocumentBaseline {
        status: "unavailable".to_owned(),
        content: None,
    }
}

fn git_read_only(root: &Path) -> std::process::Command {
    let mut command = std::process::Command::new("git");
    command
        .arg("-C")
        .arg(root)
        .args(["-c", "core.fsmonitor=false", "--no-optional-locks"]);
    command
}

fn git_head_baseline(root: &Path, relative: &str) -> DocumentBaseline {
    // Command Line Tools가 없으면 /usr/bin/git shim이 GUI 설치 대화상자를 띄우므로 먼저 차단한다.
    #[cfg(target_os = "macos")]
    {
        let selected = std::process::Command::new("/usr/bin/xcode-select")
            .arg("-p")
            .output();
        if !selected.is_ok_and(|output| output.status.success()) {
            return baseline_unavailable();
        }
    }

    let inside = git_read_only(root)
        .args(["rev-parse", "--is-inside-work-tree"])
        .output();
    let Ok(inside) = inside else {
        return baseline_unavailable();
    };
    if !inside.status.success() || String::from_utf8_lossy(&inside.stdout).trim() != "true" {
        return baseline_unavailable();
    }

    let git_relative = relative.replace(std::path::MAIN_SEPARATOR, "/");
    let show = git_read_only(root)
        .args(["show", &format!("HEAD:./{git_relative}")])
        .output();
    match show {
        Ok(output) if output.status.success() => match String::from_utf8(output.stdout) {
            Ok(content) => DocumentBaseline {
                status: "baseline".to_owned(),
                content: Some(content),
            },
            Err(_) => baseline_unavailable(),
        },
        Ok(_) => DocumentBaseline {
            status: "untracked".to_owned(),
            content: None,
        },
        Err(_) => baseline_unavailable(),
    }
}
```

설계 근거(구현자가 지킬 것):
- `HEAD:./경로`의 `./`는 pathspec을 `-C` 디렉터리 기준으로 만들어, 선택 root가 repo root의 하위 폴더여도 동작한다.
- `git show`의 blob 출력은 filter/textconv를 거치지 않으므로 repo 설정 기반 명령 실행 위험이 없고, `core.fsmonitor=false`와 `--no-optional-locks`가 나머지 실행/잠금 위험을 차단한다.
- `git show` 실패는 unborn HEAD(첫 commit 전)를 포함해 모두 `untracked`로 처리한다 — 전체-추가로 표시되는 것이 맞는 의미다.
- 이 파일에 절대 mutation git 명령을 추가하지 않는다.

`src-tauri/src/lib.rs`의 `generate_handler!` 목록에서 `library::read_document,` 다음 줄에 `library::read_document_baseline,` 추가.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`
Expected: 기존 9개 + 신규 3개 전부 PASS.

- [ ] **Step 5: Rust 게이트**

Run: `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
Expected: 경고 0. (fmt 실패 시 `cargo fmt` 후 재확인.)

---

### Task 2: `native.ts` 어댑터

**Files:**
- Modify: `src/lib/native.ts`

**Interfaces:**
- Produces: `readDocumentBaseline(root: string, path: string): Promise<DocumentBaselinePayload>`; `type DocumentBaselinePayload = { readonly status: "baseline" | "untracked" | "unavailable"; readonly content: string | null }`.
- Consumes: Task 1의 Tauri command `read_document_baseline`.

- [ ] **Step 1: 스키마 + 함수 추가**

`documentSnippetSchema` 부근에 스키마 추가, `readDocument`(native.ts:84) 아래에 함수 추가:

```ts
const documentBaselineSchema = z.object({
  content: z.string().nullable(),
  status: z.enum(["baseline", "untracked", "unavailable"]),
});

export type DocumentBaselinePayload = z.infer<typeof documentBaselineSchema>;

export async function readDocumentBaseline(
  root: string,
  path: string,
): Promise<DocumentBaselinePayload> {
  return await invokeParsed(
    "read_document_baseline",
    { path, root },
    documentBaselineSchema,
  );
}
```

주의: 기존 `invokeParsed` 패턴을 그대로 사용한다. `native.ts`는 현재 전용 unit test가 없는 repo 관례를 따르며, 계약 검증은 zod와 Task 4의 App 테스트가 담당한다.

- [ ] **Step 2: 타입/린트 확인**

Run: `pnpm check && pnpm build`
Expected: 에러 0. (build는 tsc를 포함하므로 타입 검증을 겸한다.)

---

### Task 3: `@codemirror/merge` 설치 + `DocumentDiffView` 컴포넌트

**Files:**
- Modify: `package.json` (의존성 1개)
- Create: `src/components/DocumentDiffView.tsx`
- Test: `src/components/DocumentDiffView.test.tsx`

**Interfaces:**
- Produces: `DocumentDiffView({ baseline, body, cleanLabel }: { readonly baseline: string; readonly body: string; readonly cleanLabel: string })` — read-only unified diff surface. 루트 요소 클래스 `document-diff-view`(변경 없음이면 `document-diff-view is-clean`).
- Consumes: 없음(순수 컴포넌트). Task 4가 이 컴포넌트를 사용한다.

- [ ] **Step 1: 의존성 설치**

Run: `pnpm add --save-exact @codemirror/merge@6.12.2`
Expected: `package.json` dependencies에 `"@codemirror/merge": "6.12.2"` 추가. peer 요구(`@codemirror/view ^6.17.0`)는 기존 6.43.7이 충족한다. 다른 의존성 변화가 없는지 `git diff package.json`으로 확인.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/components/DocumentDiffView.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DocumentDiffView } from "./DocumentDiffView";

describe("DocumentDiffView", () => {
  it("변경된 내용에 삭제/추가 chunk를 렌더한다", () => {
    const { container } = render(
      <DocumentDiffView
        baseline={"alpha\nbeta\n"}
        body={"alpha\ngamma\n"}
        cleanLabel="변경 없음"
      />,
    );
    expect(container.querySelector(".cm-deletedChunk")).not.toBeNull();
    expect(container.querySelector(".cm-changedLine")).not.toBeNull();
  });

  it("baseline과 동일하면 변경 없음 안내를 보여준다", () => {
    const { container } = render(
      <DocumentDiffView baseline={"same\n"} body={"same\n"} cleanLabel="변경 없음" />,
    );
    expect(screen.getByText("변경 없음")).toBeTruthy();
    expect(container.querySelector(".cm-editor")).toBeNull();
  });
});
```

클래스명 주의: `.cm-deletedChunk`/`.cm-changedLine`은 `@codemirror/merge` unified view의 base theme 클래스다. 만약 assertion이 실패하면 추측으로 고치지 말고 `node_modules/@codemirror/merge/dist/index.js`에서 `baseTheme` 정의를 열어 실제 클래스명을 확인한 뒤 테스트와 Task 5의 CSS를 함께 맞춘다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm vitest run src/components/DocumentDiffView.test.tsx`
Expected: FAIL — 모듈 없음(`DocumentDiffView` 미존재).

- [ ] **Step 4: 컴포넌트 구현**

`src/components/DocumentDiffView.tsx`:

```tsx
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { unifiedMergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

type DocumentDiffViewProps = {
  readonly baseline: string;
  readonly body: string;
  readonly cleanLabel: string;
};

export function DocumentDiffView({
  baseline,
  body,
  cleanLabel,
}: DocumentDiffViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const clean = baseline === body;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || clean) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: body,
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          markdown(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          unifiedMergeView({
            collapseUnchanged: { margin: 3, minSize: 4 },
            mergeControls: false,
            original: baseline,
          }),
        ],
      }),
    });
    return () => {
      view.destroy();
    };
  }, [baseline, body, clean]);

  if (clean) {
    return (
      <div className="document-diff-view is-clean">
        <p>{cleanLabel}</p>
      </div>
    );
  }
  return <div className="document-diff-view" ref={hostRef} />;
}
```

설계 근거: diff surface는 read-only 표시 전용이므로 `MarkdownEditor`(state 캐시, IME 처리)와 달리 baseline/body 변경 시 EditorView를 재생성하는 단순한 구조를 쓴다. `collapseUnchanged`가 "변경된 것만 보여주기" 요구를 담당한다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm vitest run src/components/DocumentDiffView.test.tsx`
Expected: 2 tests PASS.

---

### Task 4: App 통합 — baseline 조회, diff 토글, surface 전환, i18n

**Files:**
- Modify: `src/App.tsx` (LibraryApp: 상태/효과 :632 부근, 헤더 버튼 :1508 부근, surface :1559-1599)
- Modify: `src/lib/i18n.ts` (타입 :112-129 부근, en :316-333 부근, ko :491-508 부근)
- Test: `src/App.test.tsx`

**Interfaces:**
- Consumes: Task 2 `readDocumentBaseline`, Task 3 `DocumentDiffView`.
- Produces: i18n 키 `app.diffShow`, `app.diffHide`, `app.diffClean`. 토글 버튼 클래스 `diff-toggle-button`, 접근성 이름은 `diffShow`/`diffHide`.

- [ ] **Step 1: i18n 키 추가**

`I18nMessages`의 `app`에 (modeSplit 근처):

```ts
readonly diffShow: string;
readonly diffHide: string;
readonly diffClean: string;
```

en:

```ts
diffShow: "Show changes since last commit",
diffHide: "Hide changes",
diffClean: "No changes since the last commit.",
```

ko:

```ts
diffShow: "마지막 commit 이후 변경 보기",
diffHide: "변경 보기 닫기",
diffClean: "마지막 commit 이후 변경이 없습니다.",
```

- [ ] **Step 2: 실패하는 App 테스트 작성**

`src/App.test.tsx`에 추가. 기존 패턴을 그대로 따른다: hoisted `native` 객체(:141)에 `readDocumentBaseline: vi.fn()` 추가하고, `vi.mock("@/lib/native", ...)`(:183)에 `readDocumentBaseline: native.readDocumentBaseline` 한 줄 추가. `beforeEach`(:214)에 기본값 `native.readDocumentBaseline.mockResolvedValue({ content: null, status: "unavailable" })` 추가(기존 테스트가 영향받지 않도록 기본은 unavailable). AI space 활성 문서는 기존 fixture 스프레드 패턴(`testState.workspace.activeDocument = { ...activeDocument, ... }`, :1471 참고)과 `testState.settings.activeSpace = "docs"` 설정을 재사용한다.

```tsx
it("AI View에서 baseline이 있으면 diff 토글을 노출하고 diff surface로 전환한다", async () => {
  const user = userEvent.setup();
  native.readDocumentBaseline.mockResolvedValue({
    content: "---\ncreated: 2026-08-01T00:00:00.000Z\nupdated: 2026-08-01T00:00:00.000Z\n---\n\nold body\n",
    status: "baseline",
  });
  testState.settings.activeSpace = "docs";
  testState.workspace.activeDocument = {
    ...activeDocument,
    body: "new body",
    mode: "view",
    root: "/docs",
  };
  testState.workspace.openDocuments = [testState.workspace.activeDocument];

  const { container } = render(<App />);

  const toggle = await screen.findByRole("button", {
    name: "마지막 commit 이후 변경 보기",
  });
  await user.click(toggle);
  expect(container.querySelector(".document-diff-view")).not.toBeNull();
  expect(
    screen.getByRole("button", { name: "변경 보기 닫기" }),
  ).toBeTruthy();
});

it("baseline이 unavailable이면 diff 토글을 숨긴다", async () => {
  testState.settings.activeSpace = "docs";
  testState.workspace.activeDocument = {
    ...activeDocument,
    mode: "view",
    root: "/docs",
  };
  testState.workspace.openDocuments = [testState.workspace.activeDocument];

  render(<App />);

  await screen.findByRole("button", { name: "현재 View · 클릭하면 Edit | View" });
  expect(
    screen.queryByRole("button", { name: "마지막 commit 이후 변경 보기" }),
  ).toBeNull();
});

it("Human space에서는 baseline을 조회하지 않고 diff 토글도 없다", async () => {
  testState.workspace.activeDocument = { ...activeDocument, mode: "view" };
  testState.workspace.openDocuments = [testState.workspace.activeDocument];

  render(<App />);

  await screen.findByRole("button", { name: "현재 View · 클릭하면 Edit | View" });
  expect(native.readDocumentBaseline).not.toHaveBeenCalled();
  expect(
    screen.queryByRole("button", { name: "마지막 commit 이후 변경 보기" }),
  ).toBeNull();
});
```

주의: mode 버튼 접근성 이름과 AI space 진입 세부는 파일 내 기존 docs-space 테스트(예: `setWorkspaceMode`, docsRoots 설정)를 먼저 읽고 동일한 준비 코드를 재사용한다. fixture 이름이 다르면 그 파일의 실제 이름을 따른다.

- [ ] **Step 3: 테스트 실패 확인**

Run: `pnpm vitest run src/App.test.tsx`
Expected: 신규 3개 FAIL(토글 미구현), 기존 테스트는 PASS 유지.

- [ ] **Step 4: LibraryApp 구현**

`src/App.tsx` 수정:

(a) import 추가: `readDocumentBaseline`(기존 `@/lib/native` import에 병합), `parseMarkdown`(`@/lib/markdown`), `DocumentDiffView`(`@/components/DocumentDiffView`), lucide `FileDiff`.

(b) LibraryApp 상태/효과(:632 `dialog` state 근처):

```tsx
type DiffBaselineState =
  | { readonly status: "loading" }
  | { readonly status: "unavailable" }
  | { readonly status: "ready"; readonly body: string };
```

(파일 상단 타입 구역, `DocsRuntimeState` 근처에 선언.)

```tsx
const [diffBaseline, setDiffBaseline] = useState<DiffBaselineState>({
  status: "loading",
});
const [diffOpen, setDiffOpen] = useState(false);
const activeDocumentPath = workspace.activeDocument?.path ?? null;
const activeDocumentRoot = workspace.activeDocument?.root ?? null;

useEffect(() => {
  setDiffOpen(false);
  if (!aiMode || !activeDocumentPath || !activeDocumentRoot) {
    setDiffBaseline({ status: "unavailable" });
    return;
  }
  let cancelled = false;
  setDiffBaseline({ status: "loading" });
  void readDocumentBaseline(activeDocumentRoot, activeDocumentPath)
    .then((payload) => {
      if (cancelled) return;
      if (payload.status === "unavailable") {
        setDiffBaseline({ status: "unavailable" });
        return;
      }
      const content = payload.status === "baseline" ? (payload.content ?? "") : "";
      setDiffBaseline({ body: toBaselineBody(content), status: "ready" });
    })
    .catch(() => {
      if (!cancelled) setDiffBaseline({ status: "unavailable" });
    });
  return () => {
    cancelled = true;
  };
}, [activeDocumentPath, activeDocumentRoot, aiMode]);
```

module 수준 helper(컴포넌트 밖):

```tsx
function toBaselineBody(content: string): string {
  try {
    return parseMarkdown(content).body;
  } catch {
    return content;
  }
}
```

(c) 파생 조건(모드 컨트롤 계산부 :682 근처):

```tsx
const diffActive =
  aiMode &&
  diffOpen &&
  diffBaseline.status === "ready" &&
  workspace.activeDocument?.mode === "view";
```

(d) 헤더 토글 버튼 — mode 버튼(:1508) 바로 앞에:

```tsx
{aiMode &&
workspace.activeDocument.mode === "view" &&
diffBaseline.status === "ready" ? (
  <button
    aria-label={diffOpen ? messages.app.diffHide : messages.app.diffShow}
    aria-pressed={diffOpen}
    className="icon-button header-cycle-button diff-toggle-button"
    data-active={diffOpen || undefined}
    onClick={() => setDiffOpen((current) => !current)}
    title={diffOpen ? messages.app.diffHide : messages.app.diffShow}
    type="button"
  >
    <FileDiff aria-hidden="true" size={15} />
  </button>
) : null}
```

(e) surface 전환(:1583-1598): `MarkdownView` 앞에 diff surface를 추가하고, diff가 열려 있으면 `MarkdownView`는 인쇄 전용으로 유지한다(Edit 모드의 기존 `print-only` 패턴 재사용 — PDF 내보내기가 diff 상태에서도 동작한다):

```tsx
{diffActive ? (
  <DocumentDiffView
    baseline={diffBaseline.body}
    body={workspace.activeDocument.body}
    cleanLabel={messages.app.diffClean}
  />
) : null}
<MarkdownView
  body={workspace.activeDocument.body}
  className={
    workspace.activeDocument.mode === "edit" || diffActive
      ? "print-only"
      : undefined
  }
  ...나머지 props는 기존 그대로...
/>
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `pnpm vitest run src/App.test.tsx`
Expected: 신규 3개 포함 전부 PASS.

- [ ] **Step 6: 전체 프런트 게이트**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과. Biome이 props 정렬을 지적하면 지시대로 수정.

---

### Task 5: 스타일 — diff surface와 테마 토큰

**Files:**
- Modify: `src/index.css`

**Interfaces:**
- Consumes: Task 3의 `.document-diff-view` 클래스, `@codemirror/merge` base theme 클래스(`.cm-changedLine`, `.cm-changedText`, `.cm-deletedChunk`, `.cm-deletedText`, `.cm-collapsedLines`).
- Produces: 토큰 `--diff-added-bg`, `--diff-added-text-bg`, `--diff-removed-bg`, `--diff-removed-text-bg`.

- [ ] **Step 1: 실제 클래스명 확인**

Run: `grep -o '"cm-[a-zA-Z]*"\|\.cm-[a-zA-Z]*' node_modules/@codemirror/merge/dist/index.js | sort -u`
Expected: unified view가 실제로 쓰는 클래스 목록. 아래 CSS의 클래스명이 다르면 여기서 확인된 이름으로 교체한다(Task 3 테스트의 클래스명도 동일하게).

- [ ] **Step 2: 토큰과 스타일 추가**

`:root`(index.css:1) 토큰 구역에:

```css
--diff-added-bg: rgba(46, 160, 67, 0.16);
--diff-added-text-bg: rgba(46, 160, 67, 0.36);
--diff-removed-bg: rgba(248, 81, 73, 0.14);
--diff-removed-text-bg: rgba(248, 81, 73, 0.34);
```

`[data-theme="dark"]`(:136) 구역에:

```css
--diff-added-bg: rgba(63, 185, 80, 0.18);
--diff-added-text-bg: rgba(63, 185, 80, 0.4);
--diff-removed-bg: rgba(248, 81, 73, 0.18);
--diff-removed-text-bg: rgba(248, 81, 73, 0.4);
```

surface 스타일(`.editor-surface` :1551 근처에 함께 배치):

```css
.document-diff-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: auto;
}

.document-diff-view.is-clean {
  align-items: center;
  color: var(--text-muted, currentColor);
  justify-content: center;
}

.document-diff-view .cm-editor {
  height: 100%;
}

.document-diff-view .cm-editor .cm-changedLine {
  background: var(--diff-added-bg);
}

.document-diff-view .cm-editor .cm-changedText {
  background: var(--diff-added-text-bg);
}

.document-diff-view .cm-editor .cm-deletedChunk {
  background: var(--diff-removed-bg);
}

.document-diff-view .cm-editor .cm-deletedChunk .cm-deletedText {
  background: var(--diff-removed-text-bg);
}

.diff-toggle-button[data-active] {
  background: var(--diff-added-bg);
}
```

토글 활성 배경은 기존 `header-cycle-button`의 hover/active 규칙을 index.css에서 확인해 같은 강도로 맞춘다(위 값은 기본 제안).

주의: `--text-muted`는 실제 존재하는 muted 토큰명을 index.css에서 확인해 사용한다(없으면 주변 empty-state가 쓰는 색을 재사용). diff 색은 palette(`spacePalette`)와 무관한 중립 green/red를 의도적으로 쓴다 — 추가/삭제 의미색은 4개 palette 어디서든 동일해야 한다. `[data-theme="charcoal"]`은 light 계열 배경이므로 `:root` 값을 그대로 상속한다.

- [ ] **Step 3: 검증**

Run: `pnpm test && pnpm check && pnpm build`
Expected: 전부 통과. 시각 확인은 Task 6 smoke test에서 수행.

---

### Task 6: 계약 문서 갱신 + 최종 게이트 + Tauri smoke test

**Files:**
- Modify: `CLAUDE.md` (Product Contract, UI Contract)
- Modify: `docs/specs/intent-memo.md` (AI space 동작 절 — 파일을 먼저 읽고 해당 절에 맞춰 삽입)
- Modify: `DESIGN.md` (diff 토큰 4종 기록 — 파일의 기존 토큰 표 형식을 따른다)

**Interfaces:**
- Consumes: Task 1-5 완성본.

- [ ] **Step 1: CLAUDE.md 계약 문구 추가**

Product Contract 단락의 "AI edits content through the shared Edit, View, and Split modes ..." 문장 뒤에 추가:

```
AI View adds a read-only git-diff toggle that compares the active document body against its git HEAD baseline; it never runs mutating git commands and hides itself when git or a repository is unavailable.
```

UI Contract의 content-pane 항목(top row 설명)에서 far-right mode control 앞에 diff 토글을 언급하도록 해당 bullet을 갱신:

```
..., transient save status, an AI-only View-mode diff toggle (hidden when no git baseline is available), and a far-right mode control; no second header.
```

- [ ] **Step 2: intent-memo.md / DESIGN.md 갱신**

`docs/specs/intent-memo.md`를 읽고 AI space 문서 열람을 다루는 절에 위 계약과 동일한 내용(HEAD baseline, body 비교, untracked=전체 추가, unavailable=토글 숨김, read-only)을 그 문서의 서술 스타일로 추가한다. `DESIGN.md` 토큰 절에 `--diff-added-bg`/`--diff-added-text-bg`/`--diff-removed-bg`/`--diff-removed-text-bg`와 용도 한 줄을 기존 표 형식으로 추가한다.

- [ ] **Step 3: 전체 게이트 재실행**

Run: `pnpm test && pnpm check && pnpm build && cargo fmt --manifest-path src-tauri/Cargo.toml -- --check && cargo test --manifest-path src-tauri/Cargo.toml && cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings`
Expected: 전부 통과.

- [ ] **Step 4: Tauri smoke test (수동)**

Run: `pnpm tauri:dev`

시나리오(모두 확인):
1. git repo인 폴더를 AI root로 열고, commit 이후 수정된 `.md` 문서를 View로 연다 → diff 토글이 보이고, 켜면 삭제/추가 라인이 강조되고 미변경 구간이 접힌다.
2. untracked 새 `.md` 문서 → 전체가 추가로 표시된다.
3. commit 이후 변경 없는 문서 → 토글을 켜면 "변경 없음" 안내가 보인다.
4. git repo가 아닌 폴더를 AI root로 연다 → 토글이 아예 없다.
5. Human space 문서 → 토글이 없다.
6. diff 상태에서 mode 버튼으로 Edit/Split 전환 → diff surface가 사라지고 편집이 정상 동작한다. View로 돌아오면 토글 상태가 유지된다.
7. 한국어 + Dark theme + Serif typography에서 1번을 반복 → 라벨/색 대비가 정상이다.
8. diff 상태에서 PDF 내보내기 → 렌더된 View가 인쇄된다(diff가 아님).

Expected: 8개 시나리오 전부 통과. 실패 항목은 수정 후 Step 3부터 재실행.

- [ ] **Step 5: 마무리**

- `TASK-WORKBRANCH.md`(task root)의 `status:`를 `review`로 갱신한다.
- App Store sandbox 빌드(`pnpm tauri:build:mas`)에서 git 프로세스 실행이 차단될 수 있음을 알고 있어야 한다 — 차단되어도 unavailable로 퇴화해 앱은 정상 동작한다. 실제 MAS 제출 전 확인 항목으로 남긴다(이 계획의 게이트는 아님).
- 커밋은 하지 않는다. 변경 요약을 사용자에게 보고하고 git은 사용자가 처리한다.

---

## 후속 (이 계획 범위 밖)

- Phase 2: 문서 리스트/탐색기 modified 뱃지 또는 "변경된 문서만" 필터(root당 `git status --porcelain` 1회).
- MAS(App Store) 빌드에서의 git 가용성 실측.
