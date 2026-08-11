// @vitest-environment jsdom

import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
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
} from "@/components/MarkdownEditor";
import { I18nProvider } from "@/lib/i18n";
import type { Language } from "@/types/library";

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

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
        readonly findQuery: string;
      }
    >;
    const { rerender } = render(
      <FindableMarkdownEditor
        documentKey="find.md"
        findActiveIndex={0}
        findQuery="alpha"
        openDocumentKeys={["find.md"]}
        visible
        value="Alpha beta alpha"
        onChange={onChange}
      />,
    );
    const content = await screen.findByLabelText("Markdown body");
    const view = EditorView.findFromDOM(content);
    expect(view?.state.sliceDoc(0, 5)).toBe("Alpha");
    await waitFor(() => expect(view?.state.selection.main.from).toBe(0));
    expect(view?.state.selection.main.to).toBe(5);

    rerender(
      <FindableMarkdownEditor
        documentKey="find.md"
        findActiveIndex={1}
        findQuery="alpha"
        openDocumentKeys={["find.md"]}
        visible
        value="Alpha beta alpha"
        onChange={onChange}
      />,
    );

    await waitFor(() => expect(view?.state.selection.main.from).toBe(11));
    expect(view?.state.selection.main.to).toBe(16);
    expect(onChange).not.toHaveBeenCalled();
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
