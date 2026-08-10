// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DocsRootSwitcher } from "@/components/DocsRootSwitcher";
import type { WorkspaceDocument } from "@/hooks/useLibraryWorkspace";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const documents: readonly WorkspaceDocument[] = [
  {
    root: "/work/a",
    path: "a.md",
    title: "A document",
    created: "2026-08-09T00:00:00.000Z",
    updated: "2026-08-09T00:00:00.000Z",
    body: "A",
    mtimeMs: 1,
    mode: "view" as const,
    saveStatus: "idle" as const,
  },
  {
    root: "/other/b",
    path: "b.md",
    title: "B document",
    created: "2026-08-09T00:00:00.000Z",
    updated: "2026-08-09T00:00:00.000Z",
    body: "B",
    mtimeMs: 1,
    mode: "view" as const,
    saveStatus: "idle" as const,
  },
];

const getIdentity = (document: WorkspaceDocument) =>
  `${document.root}\0${document.path}`;

describe("DocsRootSwitcher", () => {
  it("renders Open File as a document action instead of a generic add", () => {
    // Given
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={vi.fn()}
        onSelect={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // When
    const openButton = screen.getByRole("button", {
      name: "Open AI document",
    });

    // Then
    expect(openButton.querySelector(".lucide-file-plus-corner")).not.toBeNull();
    expect(openButton.querySelector(".lucide-plus")).toBeNull();
  });

  it("renders a close control for each dropdown row", async () => {
    // Given
    const user = userEvent.setup();
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={vi.fn()}
        onSelect={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // When
    await user.click(
      screen.getByRole("button", {
        name: "Show open AI paths for A: /work/a/a.md",
      }),
    );

    // Then
    expect(
      screen.getByRole("button", { name: "Close A document tab" }),
    ).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Close B document tab" }),
    ).toBeDefined();
  });

  it("closes the connected document without selecting it and keeps the menu open", async () => {
    // Given
    const user = userEvent.setup();
    const onClose = vi.fn().mockResolvedValue(undefined);
    const onSelect = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={onClose}
        onOpenDocument={vi.fn()}
        onSelect={onSelect}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Show open AI paths for A: /work/a/a.md",
      }),
    );

    // When
    await user.click(
      screen.getByRole("button", { name: "Close B document tab" }),
    );
    rerender(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents.slice(0, 1)}
        getIdentity={getIdentity}
        onClose={onClose}
        onOpenDocument={vi.fn()}
        onSelect={onSelect}
      />,
    );

    // Then
    expect(onClose).toHaveBeenCalledWith("/other/b\0b.md");
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeDefined();
    const remaining = screen.getByRole("menuitemradio", {
      name: "Open A from folder a: /work/a/a.md",
    });
    await waitFor(() => expect(document.activeElement).toBe(remaining));
  });

  it("reports a rejected dropdown close and keeps the menu open", async () => {
    // Given
    const user = userEvent.setup();
    const closeError = new Error("Close failed");
    const onClose = vi.fn().mockRejectedValue(closeError);
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={onClose}
        onOpenDocument={vi.fn()}
        onSelect={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Show open AI paths for A: /work/a/a.md",
      }),
    );

    // When
    await user.click(
      screen.getByRole("button", { name: "Close B document tab" }),
    );

    // Then
    await waitFor(() => expect(report).toHaveBeenCalledWith(closeError));
    expect(screen.getByRole("menu")).toBeDefined();
  });

  it("orders shortcuts above the active path in a two-row source card", () => {
    const { container } = render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={vi.fn()}
        onSelect={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const sourceCard = container.querySelector(".source-card");
    const shortcuts = container.querySelector(".docs-root-shortcuts");
    const currentPath = screen.getByRole("button", {
      name: "Show open AI paths for A: /work/a/a.md",
    });
    expect(sourceCard?.children).toHaveLength(2);
    expect(sourceCard?.children.item(0)).toBe(shortcuts);
    expect(sourceCard?.children.item(1)).toBe(currentPath);
    expect(currentPath.textContent).toBe("A/work/a/a.md");
  });

  it("keeps shortcuts visible while the dropdown selects the same document", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={vi.fn()}
        onSelect={onSelect}
      />,
    );

    const opener = screen.getByRole("button", {
      name: "Show open AI paths for A: /work/a/a.md",
    });
    await user.click(opener);

    expect(
      screen.getByRole("button", { name: "Open path B: /other/b/b.md" }),
    ).toBeDefined();
    const first = screen.getByRole("menuitemradio", {
      name: "Open A from folder a: /work/a/a.md",
    });
    const second = screen.getByRole("menuitemradio", {
      name: "Open B from folder b: /other/b/b.md",
    });
    expect(document.activeElement).toBe(first);

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(second);
    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith("/other/b\0b.md");
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("renders square letter shortcuts connected to full file paths", () => {
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={vi.fn()}
        onSelect={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Open path A: /work/a/a.md" })
        .textContent,
    ).toBe("A");
    expect(
      screen.getByRole("button", { name: "Open path B: /other/b/b.md" })
        .textContent,
    ).toBe("B");
  });

  it("activates the document connected to a letter shortcut", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn().mockResolvedValue(undefined);
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={vi.fn()}
        onSelect={onSelect}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Open path B: /other/b/b.md" }),
    );
    expect(onSelect).toHaveBeenCalledWith("/other/b\0b.md");
  });

  it("reports a rejected shortcut selection and closes an open menu", async () => {
    const user = userEvent.setup();
    const selectionError = new Error("Selection failed");
    const onSelect = vi.fn().mockRejectedValue(selectionError);
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={vi.fn()}
        onSelect={onSelect}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Show open AI paths for A: /work/a/a.md",
      }),
    );

    await user.click(
      screen.getByRole("button", { name: "Open path B: /other/b/b.md" }),
    );

    await waitFor(() => expect(report).toHaveBeenCalledWith(selectionError));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("reports a rejected dropdown selection and closes the menu", async () => {
    const user = userEvent.setup();
    const selectionError = new Error("Selection failed");
    const onSelect = vi.fn().mockRejectedValue(selectionError);
    const report = vi.fn();
    vi.stubGlobal("reportError", report);
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={vi.fn()}
        onSelect={onSelect}
      />,
    );
    await user.click(
      screen.getByRole("button", {
        name: "Show open AI paths for A: /work/a/a.md",
      }),
    );

    await user.click(
      screen.getByRole("menuitemradio", {
        name: "Open B from folder b: /other/b/b.md",
      }),
    );

    await waitFor(() => expect(report).toHaveBeenCalledWith(selectionError));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("exposes no folder management", () => {
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={vi.fn()}
        onSelect={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.queryByText("Add folder…")).toBeNull();
    expect(screen.queryByText("Remove from list")).toBeNull();
  });

  it("opens another file from the shortcut row", async () => {
    const user = userEvent.setup();
    const onOpenDocument = vi.fn();
    render(
      <DocsRootSwitcher
        activeIdentity={"/work/a\0a.md"}
        documents={documents}
        getIdentity={getIdentity}
        onClose={vi.fn().mockResolvedValue(undefined)}
        onOpenDocument={onOpenDocument}
        onSelect={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open AI document" }));
    expect(onOpenDocument).toHaveBeenCalledOnce();
  });
});
