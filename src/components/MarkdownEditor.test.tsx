// @vitest-environment jsdom

import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentType } from "react";
import { Suspense, startTransition, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MarkdownEditor,
  markdownMarkerDecorations,
  restoreFocus,
} from "@/components/MarkdownEditor";
import { I18nProvider } from "@/lib/i18n";
import type { Language } from "@/types/library";

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function findEditorView() {
  const view = EditorView.findFromDOM(
    await screen.findByLabelText("Markdown body"),
  );
  if (!view) throw new TypeError("Editor view is required");
  return view;
}

const pending = new Promise<never>(() => {});

function PendingRender({
  active,
  onRender,
}: {
  readonly active: boolean;
  readonly onRender: () => void;
}) {
  if (active) {
    onRender();
    throw pending;
  }
  return null;
}

describe("MarkdownEditor", () => {
  it("selects the active literal find result without changing the document", async () => {
    const onChange = vi.fn();
    const FindableMarkdownEditor = MarkdownEditor as ComponentType<
      Parameters<typeof MarkdownEditor>[0] & {
        readonly findActiveIndex: number;
        readonly findMatches: readonly {
          readonly from: number;
          readonly to: number;
        }[];
      }
    >;
    const { rerender } = render(
      <FindableMarkdownEditor
        documentKey="find.md"
        findActiveIndex={0}
        findMatches={[
          { from: 1, to: 2 },
          { from: 3, to: 4 },
        ]}
        openDocumentKeys={["find.md"]}
        visible
        value="İX X"
        onChange={onChange}
      />,
    );
    const content = await screen.findByLabelText("Markdown body");
    const view = EditorView.findFromDOM(content);
    expect(view?.state.sliceDoc(1, 2)).toBe("X");
    await waitFor(() => expect(view?.state.selection.main.from).toBe(1));
    expect(view?.state.selection.main.to).toBe(2);

    rerender(
      <FindableMarkdownEditor
        documentKey="find.md"
        findActiveIndex={1}
        findMatches={[
          { from: 1, to: 2 },
          { from: 3, to: 4 },
        ]}
        openDocumentKeys={["find.md"]}
        visible
        value="İX X"
        onChange={onChange}
      />,
    );

    await waitFor(() => expect(view?.state.selection.main.from).toBe(3));
    expect(view?.state.selection.main.to).toBe(4);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps the same editor view when its own edits come back as the value", async () => {
    // Given: a parent that echoes every edit back, like the workspace does.
    const setState = vi.spyOn(EditorView.prototype, "setState");
    function Harness() {
      const [body, setBody] = useState("Long draft");
      return (
        <MarkdownEditor
          documentKey="draft.md"
          openDocumentKeys={["draft.md"]}
          visible
          value={body}
          onChange={setBody}
        />
      );
    }
    render(<Harness />);
    const view = await findEditorView();
    setState.mockClear();

    // When: the writer types and the echo re-renders the editor.
    act(() => {
      view.dispatch({
        changes: { from: view.state.doc.length, insert: "!" },
        userEvent: "input.type",
      });
    });

    // Then: the view keeps its layout state instead of being rebuilt, which
    // is what made long documents jump while typing near the bottom.
    expect(view.state.doc.toString()).toBe("Long draft!");
    expect(setState).not.toHaveBeenCalled();
  });

  it("applies an outside body change in place and keeps the caret", async () => {
    // Given: the caret sits inside the word "world".
    const onChange = vi.fn();
    const setState = vi.spyOn(EditorView.prototype, "setState");
    const { rerender } = render(
      <MarkdownEditor
        documentKey="memo.md"
        openDocumentKeys={["memo.md"]}
        visible
        value="Hello world"
        onChange={onChange}
      />,
    );
    const view = await findEditorView();
    view.dispatch({ selection: { anchor: 9 } });
    setState.mockClear();

    // When: the same document is reloaded with text added before the caret.
    rerender(
      <MarkdownEditor
        documentKey="memo.md"
        openDocumentKeys={["memo.md"]}
        visible
        value="Hello brave world"
        onChange={onChange}
      />,
    );

    // Then: the open view takes the new text without a reset or an echo.
    expect(view.state.doc.toString()).toBe("Hello brave world");
    expect(view.state.selection.main.head).toBe(15);
    expect(setState).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ignores an older echo that arrives after a newer edit", async () => {
    // Given: two quick edits whose echoes have not reached the editor yet.
    const onChange = vi.fn();
    const editor = (value: string) => (
      <MarkdownEditor
        documentKey="quick.md"
        openDocumentKeys={["quick.md"]}
        visible
        value={value}
        onChange={onChange}
      />
    );
    const { rerender } = render(editor("A"));
    const view = await findEditorView();
    view.dispatch({
      changes: { from: 1, insert: "B" },
      selection: { anchor: 2 },
    });
    view.dispatch({
      changes: { from: 2, insert: "C" },
      selection: { anchor: 3 },
    });

    // When: the parent renders the older echo before the newer one.
    rerender(editor("AB"));

    // Then: the newer text survives and nothing extra is reported back.
    expect(view.state.doc.toString()).toBe("ABC");
    rerender(editor("ABC"));
    expect(view.state.doc.toString()).toBe("ABC");
    expect(view.state.selection.main.head).toBe(3);
    expect(onChange.mock.calls).toEqual([["AB"], ["ABC"]]);
  });

  it("returns focus to the editor through the editor and keeps its caret", async () => {
    // Given: the caret is on the second line and focus moved elsewhere.
    render(
      <MarkdownEditor
        documentKey="memo.md"
        openDocumentKeys={["memo.md"]}
        visible
        value={"First\nSecond\nThird"}
        onChange={() => undefined}
      />,
    );
    const view = await findEditorView();
    view.dispatch({ selection: { anchor: 9 } });
    const editorFocus = vi.spyOn(view, "focus");
    const contentFocus = vi.spyOn(view.contentDOM, "focus");

    // When: focus is restored to the editor's content element.
    restoreFocus(view.contentDOM);

    // Then: the editor focuses itself, which keeps the caret where it was
    // instead of letting the browser move it to the top of the document.
    expect(editorFocus).toHaveBeenCalledTimes(1);
    expect(contentFocus).toHaveBeenCalledWith({ preventScroll: true });
    expect(view.state.selection.main.head).toBe(9);
  });

  it("restores focus to an element that only contains an editor as itself", async () => {
    // Given: Find was opened while nothing had focus.
    render(
      <MarkdownEditor
        documentKey="memo.md"
        openDocumentKeys={["memo.md"]}
        visible
        value="Draft"
        onChange={() => undefined}
      />,
    );
    const view = await findEditorView();
    const editorFocus = vi.spyOn(view, "focus");
    const bodyFocus = vi.spyOn(document.body, "focus");

    // When: focus is restored to the page body.
    restoreFocus(document.body);

    // Then: focus is not pulled into the editor.
    expect(editorFocus).not.toHaveBeenCalled();
    expect(bodyFocus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("rebuilds marker decorations for each visible range after viewport changes", () => {
    // Given: three headings with only the first and last ranges visible.
    const value = "# First\n\n# Middle\n\n# Last";
    const middleStart = value.indexOf("# Middle");
    const lastStart = value.indexOf("# Last");
    const state = EditorState.create({
      doc: value,
      extensions: [markdown(), markdownMarkerDecorations],
    });
    const view = new EditorView({ state });
    Object.defineProperty(view, "visibleRanges", {
      configurable: true,
      value: [
        { from: 0, to: middleStart },
        { from: lastStart, to: value.length },
      ],
    });
    const plugin = view.plugin(markdownMarkerDecorations);
    if (!plugin) throw new TypeError("Markdown marker plugin is required");

    // When: the viewport changes without a document edit.
    const update = { docChanged: false, viewportChanged: true, view };
    plugin.update(update);
    const markers: string[] = [];
    plugin.decorations.between(0, value.length, (from, to) => {
      markers.push(value.slice(from, to));
    });
    view.destroy();

    // Then: only markers inside each visible range are decorated.
    expect(markers).toEqual(["#", "#"]);
  });

  it("marks Markdown syntax markers without coloring content text", async () => {
    const { container } = render(
      <MarkdownEditor
        documentKey="markers.md"
        openDocumentKeys={["markers.md"]}
        visible
        value={"# Heading\n\n- Item\n\n> Quote\n\n```ts\ncode\n```\n\n---"}
        onChange={() => undefined}
      />,
    );

    await screen.findByLabelText("Markdown body");
    const markers = [...container.querySelectorAll(".cm-space-mark")].map(
      (element) => element.textContent,
    );

    expect(markers).toEqual(
      expect.arrayContaining(["#", "-", ">", "```", "---"]),
    );
    expect(
      [...container.querySelectorAll(".cm-space-mark")].some((element) =>
        /Heading|Item|Quote|code/.test(element.textContent ?? ""),
      ),
    ).toBe(false);
  });

  it("keeps the localized label across cached editor states", async () => {
    // Given: the first document has an editor state created in English.
    function Harness() {
      const [language, setLanguage] = useState<Language>("en");
      const [documentKey, setDocumentKey] = useState("first.md");
      return (
        <I18nProvider language={language}>
          <button type="button" onClick={() => setDocumentKey("first.md")}>
            First
          </button>
          <button type="button" onClick={() => setDocumentKey("second.md")}>
            Second
          </button>
          <button type="button" onClick={() => setLanguage("ko")}>
            한국어
          </button>
          <MarkdownEditor
            documentKey={documentKey}
            openDocumentKeys={["first.md", "second.md"]}
            visible
            value={documentKey === "first.md" ? "First draft" : "Second draft"}
            onChange={() => undefined}
          />
        </I18nProvider>
      );
    }

    render(<Harness />);
    expect((await screen.findByLabelText("Markdown body")).textContent).toBe(
      "First draft",
    );

    // When: Korean is committed before creating a second state and restoring the first.
    fireEvent.click(screen.getByRole("button", { name: "한국어" }));
    expect((await screen.findByLabelText("Markdown 본문")).textContent).toBe(
      "First draft",
    );
    fireEvent.click(screen.getByRole("button", { name: "Second" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Markdown 본문").textContent).toBe(
        "Second draft",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "First" }));

    // Then: the cached state keeps the committed label and its document content.
    await waitFor(() =>
      expect(screen.getByLabelText("Markdown 본문").textContent).toBe(
        "First draft",
      ),
    );
  });

  it("keeps using the committed onChange while a callback update is pending", async () => {
    const committedOnChange = vi.fn();
    const pendingOnChange = vi.fn();
    const pendingRender = vi.fn();

    function Harness() {
      const [onChange, setOnChange] = useState(() => committedOnChange);
      const [isPending, setIsPending] = useState(false);

      return (
        <>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                setOnChange(() => pendingOnChange);
                setIsPending(true);
              });
            }}
          >
            Change callback
          </button>
          <Suspense fallback={null}>
            <MarkdownEditor
              documentKey="memo.md"
              openDocumentKeys={["memo.md"]}
              visible
              value="Initial"
              onChange={onChange}
            />
            <PendingRender active={isPending} onRender={pendingRender} />
          </Suspense>
        </>
      );
    }

    render(<Harness />);
    const content = await screen.findByLabelText("Markdown body");
    const view = EditorView.findFromDOM(content);
    expect(view).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Change callback" }));
    await waitFor(() => expect(pendingRender).toHaveBeenCalled());

    view?.dispatch({ changes: { from: view.state.doc.length, insert: "!" } });

    expect(pendingOnChange).not.toHaveBeenCalled();
    expect(committedOnChange).toHaveBeenCalledWith("Initial!");
  });
});
