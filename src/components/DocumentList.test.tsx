// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DocumentDensity, DocumentEntry } from "../types/library";
import { DocumentList } from "./DocumentList";

const documents: readonly DocumentEntry[] = [
  { path: "a.md", parent: "", title: "A", updatedMs: 1 },
  { path: "b.md", parent: "", title: "B", updatedMs: 1 },
];

const resizeObservers = new Map<ResizeObserverStub, ResizeObserverCallback>();

class ResizeObserverStub implements ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeObservers.set(this, callback);
  }

  readonly disconnect = vi.fn(() => resizeObservers.delete(this));
  readonly observe = vi.fn();
  readonly unobserve = vi.fn();
}

type RenderListOptions = {
  readonly density?: DocumentDensity;
  readonly documents?: readonly DocumentEntry[];
  readonly ensureSelectedVisible?: boolean;
  readonly selectedPath?: string | null;
  readonly snippets?: ReadonlyMap<string, string>;
};

let containerRect = new DOMRect(0, 0, 200, 100);
let selectedRect = new DOMRect(0, 20, 200, 30);
const scrollIntoView = vi.fn();

function renderList({
  density = "simple",
  documents: entries = documents,
  ensureSelectedVisible = true,
  selectedPath = "b.md",
  snippets = new Map(),
}: RenderListOptions = {}) {
  const inert = vi.fn();
  const props = {
    density,
    documents: entries,
    ensureSelectedVisible,
    onMove: inert,
    onRename: inert,
    onSelect: inert,
    onTrash: inert,
    selectedPath,
    snippets,
  } satisfies ComponentProps<typeof DocumentList>;

  return render(
    <>
      <button type="button">Outside focus</button>
      <DocumentList {...props} />
    </>,
  );
}

function triggerResize(): void {
  act(() => {
    for (const [observer, callback] of resizeObservers) callback([], observer);
  });
}

beforeEach(() => {
  resizeObservers.clear();
  scrollIntoView.mockClear();
  containerRect = new DOMRect(0, 0, 200, 100);
  selectedRect = new DOMRect(0, 20, 200, 30);
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: ResizeObserverStub,
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.classList.contains("document-list")) return containerRect;
      if (this.getAttribute("aria-selected") === "true") return selectedRect;
      return new DOMRect();
    },
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DocumentList selected row visibility", () => {
  it("keeps the scroll position when the selected row is fully visible", () => {
    // Given: the selected row is inside the list viewport.
    selectedRect = new DOMRect(0, 20, 200, 30);

    // When: visibility tracking is enabled.
    renderList();

    // Then: the browser scroll position is untouched.
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it.each([
    ["above", new DOMRect(0, -20, 200, 30)],
    ["below", new DOMRect(0, 110, 200, 30)],
  ])("scrolls the selected row when it is %s the viewport", (_position, rect) => {
    // Given: the selected row is outside one edge of the list viewport.
    selectedRect = rect;

    // When: visibility tracking is enabled.
    renderList();

    // Then: the nearest browser scroll brings the row back into view.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("does not scroll without a selected row", () => {
    // Given: the list has documents but no active selection.
    renderList({ selectedPath: null });

    // When: the visibility effect runs after render.
    triggerResize();

    // Then: no row is scrolled.
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("does not scroll an empty list", () => {
    // Given: the list has no rendered documents.
    renderList({ documents: [] });

    // When: the visibility effect runs after render.
    triggerResize();

    // Then: no row is scrolled.
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("rechecks visibility when rendered documents change", () => {
    // Given: the selected row begins fully visible.
    const { rerender } = renderList();
    scrollIntoView.mockClear();
    selectedRect = new DOMRect(0, 110, 200, 30);

    // When: the rendered document collection is replaced.
    rerender(
      <DocumentList
        density="simple"
        documents={[...documents]}
        ensureSelectedVisible
        onMove={vi.fn()}
        onRename={vi.fn()}
        onSelect={vi.fn()}
        onTrash={vi.fn()}
        selectedPath="b.md"
        snippets={new Map()}
      />,
    );

    // Then: the new geometry is scrolled into view.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("rechecks visibility when snippets change row geometry", () => {
    // Given: the selected row begins fully visible before snippets arrive.
    const { rerender } = renderList({ density: "full" });
    scrollIntoView.mockClear();
    selectedRect = new DOMRect(0, 110, 200, 30);

    // When: asynchronously loaded snippets are rendered.
    rerender(
      <DocumentList
        density="full"
        documents={documents}
        ensureSelectedVisible
        onMove={vi.fn()}
        onRename={vi.fn()}
        onSelect={vi.fn()}
        onTrash={vi.fn()}
        selectedPath="b.md"
        snippets={new Map([["a.md", "Expanded snippet"]])}
      />,
    );

    // Then: the displaced selected row is brought back into view.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("rechecks visibility when density changes row geometry", () => {
    // Given: the selected row begins fully visible at simple density.
    const { rerender } = renderList();
    scrollIntoView.mockClear();
    selectedRect = new DOMRect(0, 110, 200, 30);

    // When: density expands the rendered rows.
    rerender(
      <DocumentList
        density="full"
        documents={documents}
        ensureSelectedVisible
        onMove={vi.fn()}
        onRename={vi.fn()}
        onSelect={vi.fn()}
        onTrash={vi.fn()}
        selectedPath="b.md"
        snippets={new Map()}
      />,
    );

    // Then: the displaced selected row is brought back into view.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("rechecks visibility when the scroll container resizes", () => {
    // Given: the selected row begins fully visible in a tall container.
    renderList();
    scrollIntoView.mockClear();
    containerRect = new DOMRect(0, 0, 200, 40);
    selectedRect = new DOMRect(0, 50, 200, 30);

    // When: the browser reports the container resize.
    triggerResize();

    // Then: the selected row is brought back into view.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  });

  it("preserves focus while scrolling the selected row", () => {
    // Given: keyboard focus is outside an offscreen selected row.
    selectedRect = new DOMRect(0, 110, 200, 30);
    renderList();
    const outside = screen.getByRole("button", { name: "Outside focus" });
    outside.focus();

    // When: the container resize rechecks visibility.
    triggerResize();

    // Then: scrolling does not move DOM focus.
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    expect(document.activeElement).toBe(outside);
  });

  it("keeps Human-style lists unchanged when visibility tracking is disabled", () => {
    // Given: an offscreen selected row uses the default disabled behavior.
    selectedRect = new DOMRect(0, 110, 200, 30);

    // When: the list renders without enabling visibility tracking.
    renderList({ ensureSelectedVisible: false });

    // Then: no observer or scroll side effect is created.
    expect(resizeObservers.size).toBe(0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
