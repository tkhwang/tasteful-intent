// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TabBar } from "@/components/TabBar";
import type { WorkspaceDocument } from "@/hooks/useLibraryWorkspace";

afterEach(cleanup);

function documentAt(title: string): WorkspaceDocument {
  return {
    root: "/library",
    path: `${title}.md`,
    title,
    created: "2026-01-01T00:00:00.000Z",
    updated: "2026-01-01T00:00:00.000Z",
    body: "",
    mtimeMs: 0,
    mode: "edit",
    saveStatus: "idle",
  };
}

function renderTabBar(
  titles: readonly string[],
  handlers: {
    readonly onClose?: (path: string) => Promise<void>;
    readonly onCloseMany?: (paths: readonly string[]) => Promise<void>;
  } = {},
) {
  render(
    <TabBar
      activePath={`${titles[0]}.md`}
      documents={titles.map(documentAt)}
      leadingAction={null}
      onClose={handlers.onClose ?? (async () => undefined)}
      onCloseMany={handlers.onCloseMany ?? (async () => undefined)}
      onSelect={() => undefined}
      trailingActions={null}
    />,
  );
}

function openTabMenu(title: string) {
  fireEvent.contextMenu(screen.getByRole("tab", { name: title }));
}

describe("TabBar tab context menu", () => {
  it("closes the other tabs from the right-clicked tab", async () => {
    // Given: three open tabs and a menu opened on the middle one.
    const onCloseMany = vi.fn(async () => undefined);
    renderTabBar(["alpha", "beta", "gamma"], { onCloseMany });
    openTabMenu("beta");

    // When: the reader chooses Close other tabs.
    await userEvent.click(
      screen.getByRole("menuitem", { name: "Close other tabs" }),
    );

    // Then: every tab except the right-clicked one is closed.
    expect(onCloseMany).toHaveBeenCalledWith(["alpha.md", "gamma.md"]);
  });

  it("closes only the tabs to the right of the right-clicked tab", async () => {
    const onCloseMany = vi.fn(async () => undefined);
    renderTabBar(["alpha", "beta", "gamma"], { onCloseMany });
    openTabMenu("beta");

    await userEvent.click(
      screen.getByRole("menuitem", { name: "Close tabs to the right" }),
    );

    expect(onCloseMany).toHaveBeenCalledWith(["gamma.md"]);
  });

  it("closes every open tab in list order", async () => {
    const onCloseMany = vi.fn(async () => undefined);
    renderTabBar(["alpha", "beta", "gamma"], { onCloseMany });
    openTabMenu("gamma");

    await userEvent.click(
      screen.getByRole("menuitem", { name: "Close all tabs" }),
    );

    expect(onCloseMany).toHaveBeenCalledWith([
      "alpha.md",
      "beta.md",
      "gamma.md",
    ]);
  });

  it("closes a single tab through the same handler as the close button", async () => {
    const onClose = vi.fn(async () => undefined);
    renderTabBar(["alpha", "beta"], { onClose });
    openTabMenu("beta");

    await userEvent.click(screen.getByRole("menuitem", { name: "Close tab" }));

    expect(onClose).toHaveBeenCalledWith("beta.md");
  });

  it("omits multi-tab actions that would do nothing", () => {
    // Given: the last tab of a single-tab bar.
    renderTabBar(["alpha"]);
    openTabMenu("alpha");

    // Then: only the actions with a target remain.
    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual(["Close tab", "Close all tabs"]);
  });

  it("opens the menu from the keyboard on the focused tab", () => {
    renderTabBar(["alpha", "beta"]);
    const tab = screen.getByRole("tab", { name: "beta" });
    tab.focus();

    fireEvent.keyDown(tab, { key: "F10", shiftKey: true });

    expect(
      screen.getByRole("menu", { name: "beta tab actions" }),
    ).toBeDefined();
  });
});
