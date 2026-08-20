// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LayoutSettings, LibrarySnapshot } from "@/types/library";

const snapshot: LibrarySnapshot = {
  folders: [
    { path: "projects", parent: "", name: "projects" },
    {
      path: "projects/nested",
      parent: "projects",
      name: "nested",
    },
  ],
  documents: [
    { path: "root.md", parent: "", title: "Root", updatedMs: 1 },
    {
      path: "projects/nested/peer.md",
      parent: "projects/nested",
      title: "Peer",
      updatedMs: 1,
    },
    {
      path: "projects/nested/target.md",
      parent: "projects/nested",
      title: "Target",
      updatedMs: 1,
    },
  ],
};

const settings: LayoutSettings = {
  settingsSchemaVersion: 2,
  libraryRoot: "/human",
  docsRoots: [{ root: "/work/docs", label: null }],
  docsRoot: "/work/docs",
  activeSpace: "docs",
  folderPaneOpen: true,
  listPaneOpen: true,
  documentDensity: "simple",
  documentSort: "title",
  theme: "light",
  spacePalette: "classic",
  language: "en",
  writingFont: "sans",
  tabSessions: {
    intent: { paths: [], activePath: null },
    docs: { "/work/docs": { paths: [], activePath: null } },
  },
};

const native = vi.hoisted(() => ({
  readDocument: vi.fn(),
  readDocumentBaseline: vi.fn(),
  readDocumentSnippets: vi.fn(),
  scanDocsRoot: vi.fn(),
}));

const settingsStore = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    destroy: vi.fn(),
    onCloseRequested: vi.fn().mockResolvedValue(vi.fn()),
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@/lib/native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/native")>()),
  readDocument: native.readDocument,
  readDocumentBaseline: native.readDocumentBaseline,
  readDocumentSnippets: native.readDocumentSnippets,
  scanDocsRoot: native.scanDocsRoot,
}));

vi.mock("@/lib/settings", () => ({
  loadSettings: settingsStore.loadSettings,
  nextPaneLayout: vi.fn(),
  saveSettings: settingsStore.saveSettings,
}));

import { App } from "./App";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  settingsStore.loadSettings.mockResolvedValue(settings);
  settingsStore.saveSettings.mockResolvedValue(undefined);
  native.scanDocsRoot.mockResolvedValue(snapshot);
  native.readDocument.mockImplementation((_root: string, path: string) =>
    Promise.resolve({
      path,
      content: `---\ncreated: 2026-08-21T00:00:00.000Z\nupdated: 2026-08-21T00:00:00.000Z\n---\n${path}`,
      mtimeMs: 1,
    }),
  );
  native.readDocumentSnippets.mockImplementation(
    (_root: string, paths: readonly string[]) =>
      Promise.resolve(paths.map((path) => ({ path, snippet: path }))),
  );
  native.readDocumentBaseline.mockResolvedValue({
    content: null,
    status: "unavailable",
  });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: vi.fn(() => ({
      length: 0,
      item: () => null,
      *[Symbol.iterator]() {},
    })),
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => new DOMRect()),
  });
});

describe("App AI workspace integration", () => {
  it("shows an Explorer file in its parent Document List without reload", async () => {
    // Given: a nested Explorer branch is expanded while the root folder owns the list.
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "projects" }));
    await user.click(screen.getByRole("button", { name: "nested" }));
    await user.click(screen.getByRole("button", { name: "docs" }));
    expect(screen.getByText("1 notes")).toBeDefined();

    // When: the nested file is activated from the Explorer.
    await user.click(screen.getByRole("button", { name: "Target" }));

    // Then: the parent list, selected row, and content tab update together.
    expect(await screen.findByText("2 notes")).toBeDefined();
    const selected = await screen.findByRole("option", { name: "Target" });
    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(
      screen
        .getByRole("tab", { name: /target.*target\.md/i })
        .getAttribute("aria-selected"),
    ).toBe("true");

    // Given: the root folder is selected again while the same file stays active.
    await user.click(screen.getByRole("button", { name: "docs" }));
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "Target" })).toBeNull(),
    );

    // When: the same active Explorer file is clicked again.
    await user.click(screen.getByRole("button", { name: "Target" }));

    // Then: its parent list is restored without the reload action.
    expect(await screen.findByRole("option", { name: "Target" })).toBeDefined();
    expect(native.readDocument).toHaveBeenCalledTimes(1);
  });
});
