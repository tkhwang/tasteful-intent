// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocsRootSwitcher } from "@/components/DocsRootSwitcher";
import type { DocsRootEntry } from "@/types/library";

afterEach(() => cleanup());

const roots: readonly DocsRootEntry[] = [
  { root: "/work/a", label: "A" },
  { root: "/work/b", label: "B" },
  { root: "/work/c", label: null },
  { root: "/work/d", label: null },
];
const availability = new Map([
  ["/work/a", "available"],
  ["/work/b", "unavailable"],
  ["/work/c", "available"],
  ["/work/d", "unavailable"],
] as const);

function switcherElement(
  overrides: Partial<React.ComponentProps<typeof DocsRootSwitcher>> = {},
) {
  return (
    <DocsRootSwitcher
      activeRoot="/work/a"
      availability={availability}
      onClose={vi.fn().mockResolvedValue(true)}
      onEditLabel={vi.fn()}
      onOpenFolder={vi.fn()}
      onPin={vi.fn()}
      onRefresh={vi.fn().mockResolvedValue(true)}
      onSelect={vi.fn().mockResolvedValue(true)}
      onUnpin={vi.fn()}
      roots={roots}
      {...overrides}
    />
  );
}

function renderSwitcher(
  overrides: Partial<React.ComponentProps<typeof DocsRootSwitcher>> = {},
) {
  return render(switcherElement(overrides));
}

describe("DocsRootSwitcher", () => {
  it("shows pinned labels only in the shortcut header", () => {
    // Given: pinned and unpinned AI roots are open.
    const { container } = renderSwitcher();

    // When: the Source Card renders its shortcut header.
    const header = container.querySelector(".docs-root-pinned-row");

    // Then: only pinned labels and the open-folder action appear there.
    expect(header?.textContent).toBe("AB");
    expect(header?.querySelectorAll(".docs-root-shortcut")).toHaveLength(2);
    expect(header?.querySelectorAll(".docs-root-actions")).toHaveLength(0);
    expect(header?.querySelector(".docs-root-open")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Open AI folder" }),
    ).toBeDefined();
  });

  it("shows every open root in the vertical path list", () => {
    // Given: four roots are open across pinned and unpinned states.
    const { container } = renderSwitcher();

    // When: the Source Card renders its path list.
    const rows = container.querySelectorAll(".docs-root-path-row");

    // Then: all roots stay visible in stored order with compact paths.
    expect(rows).toHaveLength(4);
    expect(Array.from(rows, (row) => row.textContent)).toEqual([
      "A|…/work/a",
      "B|…/work/b",
      "…/work/c",
      "…/work/d",
    ]);
  });

  it("prefixes pinned path rows with their label", () => {
    // Given: root A is pinned and root C is not.
    const { container } = renderSwitcher();

    // When: their path rows are inspected.
    const pinned = container.querySelector('[data-root="/work/a"]');
    const unpinned = container.querySelector('[data-root="/work/c"]');

    // Then: only the pinned path is prefixed by a label and divider.
    expect(pinned?.querySelector(".docs-root-path-label")?.textContent).toBe(
      "A",
    );
    expect(pinned?.querySelector(".docs-root-path-divider")?.textContent).toBe(
      "|",
    );
    expect(unpinned?.querySelector(".docs-root-path-label")).toBeNull();
    expect(unpinned?.querySelector(".docs-root-path-divider")).toBeNull();
  });

  it("keeps canonical paths in titles and accessible names", () => {
    // Given: a deep pinned root is open.
    const deepRoots: readonly DocsRootEntry[] = [
      { root: "/Users/example/aaa/bbb", label: "A" },
    ];
    const { container } = renderSwitcher({
      activeRoot: deepRoots[0].root,
      roots: deepRoots,
    });

    // When: the visible path row is rendered.
    const select = container.querySelector<HTMLButtonElement>(
      ".docs-root-path-row .docs-root-select",
    );

    // Then: the visible copy is compact while semantic text stays canonical.
    expect(select?.textContent).toBe("A|…/aaa/bbb");
    expect(select?.title).toBe("[A] /Users/example/aaa/bbb");
    expect(select?.getAttribute("aria-label")).toContain(
      "/Users/example/aaa/bbb",
    );
  });

  it("selects a root from the primary button without opening its menu", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(true);
    renderSwitcher({ onSelect });

    await user.click(
      screen.getByRole("button", {
        name: "Open pinned AI folder A, a: /work/a",
      }),
    );

    expect(onSelect).toHaveBeenCalledWith("/work/a");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens the requested root menu without changing the active root", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(true);
    renderSwitcher({ onSelect });

    await user.click(
      screen.getByRole("button", {
        name: "Open actions for c: /work/c",
      }),
    );

    expect(onSelect).not.toHaveBeenCalled();
    expect(
      screen.getByRole("menu", { name: "Actions for c: /work/c" }),
    ).toBeDefined();
  });

  it("positions the action menu in viewport coordinates outside the clipped pane", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    const opener = screen.getByRole("button", {
      name: "Open actions for c: /work/c",
    });
    vi.spyOn(opener, "getBoundingClientRect").mockReturnValue(
      new DOMRect(180, 180, 30, 20),
    );

    await user.click(opener);

    const menu = screen.getByRole("menu", { name: "Actions for c: /work/c" });
    expect(menu.style.left).toBe("78px");
    expect(menu.style.top).toBe("204px");
  });

  it("uses a pressed Pin toggle and keeps only Edit label in the pinned menu", async () => {
    // Given: root A is pinned.
    const user = userEvent.setup();
    const onEditLabel = vi.fn();
    const onUnpin = vi.fn();
    renderSwitcher({ onEditLabel, onUnpin });

    // When: the direct Pin toggle is pressed.
    const toggle = screen.getByRole("button", {
      name: "Unpin AI folder a: /work/a",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    await user.click(toggle);

    // Then: unpin runs directly and the menu retains only label editing.
    expect(onUnpin).toHaveBeenCalledWith("/work/a");
    await user.click(
      screen.getByRole("button", { name: "Open actions for a: /work/a" }),
    );
    expect(screen.queryByRole("menuitem", { name: "Unpin" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Edit label" }));
    expect(onEditLabel).toHaveBeenCalledWith(
      "/work/a",
      expect.any(HTMLElement),
    );
  });

  it("uses an unpressed Pin toggle and keeps only Close in the unpinned menu", async () => {
    // Given: root C is unpinned.
    const user = userEvent.setup();
    const onPin = vi.fn();
    const onClose = vi.fn().mockResolvedValue(true);
    renderSwitcher({ onClose, onPin });

    // When: the direct Pin toggle is pressed.
    const toggle = screen.getByRole("button", {
      name: "Pin AI folder c: /work/c",
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    await user.click(toggle);

    // Then: label entry starts directly and the menu retains only Close.
    expect(onPin).toHaveBeenCalledWith("/work/c", expect.any(HTMLElement));
    await user.click(
      screen.getByRole("button", { name: "Open actions for c: /work/c" }),
    );
    expect(screen.queryByRole("menuitem", { name: "Pin" })).toBeNull();
    await user.click(screen.getByRole("menuitem", { name: "Close" }));
    expect(onClose).toHaveBeenCalledWith("/work/c");
  });

  it("offers targeted Refresh for unavailable pinned and unpinned entries", async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn().mockResolvedValue(true);
    renderSwitcher({ onRefresh });

    await user.click(
      screen.getByRole("button", { name: "Open actions for b: /work/b" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledWith("/work/b");

    await user.click(
      screen.getByRole("button", { name: "Open actions for d: /work/d" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Refresh" }));
    expect(onRefresh).toHaveBeenCalledWith("/work/d");
  });

  it("supports Arrow, Home, End, Enter, Space, and Escape in the action menu", async () => {
    // Given: unavailable root D has Refresh and Close menu actions.
    const user = userEvent.setup();
    const onClose = vi.fn().mockResolvedValue(true);
    const onRefresh = vi.fn().mockResolvedValue(true);
    renderSwitcher({ onClose, onRefresh });
    const opener = screen.getByRole("button", {
      name: "Open actions for d: /work/d",
    });

    // When: keyboard navigation traverses the menu and activates its first item.
    await user.click(opener);
    const refresh = screen.getByRole("menuitem", { name: "Refresh" });
    const close = screen.getByRole("menuitem", { name: "Close" });
    expect(document.activeElement).toBe(refresh);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(close);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(refresh);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(close);
    await user.keyboard("{Escape}");
    expect(document.activeElement).toBe(opener);

    await user.click(opener);
    await user.keyboard("{Enter}");
    expect(onRefresh).toHaveBeenCalledWith("/work/d");
    await user.click(opener);
    await user.keyboard(" ");
    expect(onRefresh).toHaveBeenCalledTimes(2);

    // Then: all keyboard paths preserve the existing menu behavior.
    expect(onClose).not.toHaveBeenCalled();
  });

  it("restores focus to the moved root after Unpin", async () => {
    // Given: the pinned root A owns keyboard focus through its direct toggle.
    const user = userEvent.setup();
    const onUnpin = vi.fn();
    const { rerender } = renderSwitcher({ onUnpin });
    await user.click(
      screen.getByRole("button", { name: "Unpin AI folder a: /work/a" }),
    );

    // When: the parent applies the unpinned list transformation.
    rerender(
      switcherElement({
        activeRoot: "/work/a",
        onUnpin,
        roots: [roots[1], { root: "/work/a", label: null }, roots[2], roots[3]],
      }),
    );

    // Then: focus follows the same root's moved Pin toggle.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", {
          name: "Pin AI folder a: /work/a",
        }),
      ),
    );
  });

  it("clears a pending Unpin focus request when its root disappears", async () => {
    const user = userEvent.setup();
    const onUnpin = vi.fn();
    const { rerender } = renderSwitcher({ onUnpin });
    await user.click(
      screen.getByRole("button", { name: "Unpin AI folder a: /work/a" }),
    );

    rerender(switcherElement({ onUnpin, roots: roots.slice(1) }));
    const openFolder = screen.getByRole("button", { name: "Open AI folder" });
    openFolder.focus();
    rerender(
      switcherElement({
        onUnpin,
        roots: [{ root: "/work/a", label: null }, ...roots.slice(1)],
      }),
    );

    await waitFor(() => expect(document.activeElement).toBe(openFolder));
  });

  it("restores focus right then left after Close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn().mockResolvedValue(true);
    const { rerender } = renderSwitcher({ onClose });
    await user.click(
      screen.getByRole("button", { name: "Open actions for c: /work/c" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Close" }));
    rerender(
      switcherElement({
        activeRoot: "/work/d",
        onClose,
        roots: [roots[0], roots[1], roots[3]],
      }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Open actions for d: /work/d" }),
      ),
    );

    await user.click(
      screen.getByRole("button", { name: "Open actions for d: /work/d" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Close" }));
    rerender(
      switcherElement({
        activeRoot: "/work/b",
        onClose,
        roots: [roots[0], roots[1]],
      }),
    );
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Open actions for b: /work/b" }),
      ),
    );
  });
});
