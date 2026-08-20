// @vitest-environment jsdom

import { EditorView } from "@codemirror/view";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FolderTree } from "@/components/FolderTree";
import type {
  SaveStatus,
  useLibraryWorkspace,
  WorkspaceDocument,
} from "@/hooks/useLibraryWorkspace";
import type { EditorMode, LayoutSettings, TabSession } from "@/types/library";

type WorkspaceState = ReturnType<typeof useLibraryWorkspace>;
type Mutable<T> = {
  -readonly [Key in keyof T]: T[Key] extends object ? Mutable<T[Key]> : T[Key];
};
type MediaListener = () => void;
type MediaQueryListState = {
  readonly query: string;
  matches: boolean;
  readonly registrations: Map<MediaListener, number>;
  readonly removals: Map<MediaListener, number>;
};
type WorkspaceOptions = {
  readonly initialSession?: TabSession;
  readonly initialSnapshot?: unknown;
  readonly onSessionChange?: (session: TabSession) => void;
  readonly scan?: unknown;
};

const testState = vi.hoisted(() => {
  const openDocuments: WorkspaceDocument[] = [];
  const activePath: string | null = null;
  const activeDocument: WorkspaceDocument | null = null;
  const saveStatus: SaveStatus = "idle";
  const sessionChanges: ((session: TabSession) => void)[] = [];
  const workspaceOptions: WorkspaceOptions[] = [];

  const workspace: WorkspaceState = {
    snapshot: {
      folders: [
        { path: "projects", parent: "", name: "projects" },
        {
          path: "projects/current",
          parent: "projects",
          name: "current",
        },
        {
          path: "projects/current/child",
          parent: "projects/current",
          name: "child",
        },
        {
          path: "projects/sibling",
          parent: "projects",
          name: "sibling",
        },
        { path: "other", parent: "", name: "other" },
      ],
      documents: [],
    },
    visibleDocuments: [],
    visibleSnippets: new Map<string, string>(),
    selectedFolder: "",
    openDocuments,
    activePath,
    activeDocument,
    loading: false,
    reloadingCurrentDocument: false,
    errorMessage: null,
    rootUnavailable: false,
    saveStatus,
    setSelectedFolder: vi.fn(),
    setActiveDocument: vi.fn(),
    openDocument: vi.fn(),
    closeDocument: vi.fn(),
    reloadCurrentDocument: vi.fn(),
    updateBody: vi.fn(),
    setMode: vi.fn(),
    addDocument: vi.fn(),
    addFolder: vi.fn(),
    renameActive: vi.fn(),
    renameFolderAt: vi.fn(),
    moveActive: vi.fn(),
    moveFolderAt: vi.fn(),
    removeActive: vi.fn(),
    removeFolderAt: vi.fn(),
    persistCurrent: vi.fn(),
    persistAllOpenDocuments: vi.fn(),
    refresh: vi.fn(),
    clearError: vi.fn(),
  };

  const settings: Mutable<LayoutSettings> = {
    settingsSchemaVersion: 2,
    libraryRoot: "/intent",
    docsRoots: [{ root: "/docs", label: null }],
    docsRoot: "/docs",
    activeSpace: "intent",
    folderPaneOpen: true,
    listPaneOpen: true,
    documentDensity: "full",
    documentSort: "updated" as "updated" | "title",
    theme: "light" as "light" | "charcoal" | "dark" | "system",
    spacePalette: "classic" as
      | "classic"
      | "terracotta-teal"
      | "plum-moss"
      | "mono-duo",
    language: "ko" as "en" | "ko",
    writingFont: "sans" as "sans" | "serif",
    tabSessions: {
      intent: { paths: [], activePath: null },
      docs: { "/docs": { paths: [], activePath: null } },
    },
  };

  return {
    settings,
    sessionChanges,
    workspaceOptions,
    workspace,
  };
});

const dialog = vi.hoisted(() => ({
  confirm: vi.fn(),
  open: vi.fn(),
}));

const native = vi.hoisted(() => ({
  printDocument: vi.fn<() => Promise<void>>(),
  readDocumentBaseline: vi.fn(),
  readDocumentImage:
    vi.fn<
      (
        root: string,
        documentPath: string,
        source: string,
      ) => Promise<{
        readonly bytes: readonly number[];
        readonly mimeType: string;
      }>
    >(),
  resolveLibraryRoot: vi.fn<(path: string) => Promise<string>>(),
  scanDocsRoot: vi.fn(),
}));

const mediaState = vi.hoisted(() => {
  const lists: MediaQueryListState[] = [];
  return {
    matchesByQuery: new Map<string, boolean>(),
    lists,
  };
});

function setWorkspaceMode(mode: EditorMode): void {
  const activeDocument = testState.workspace.activeDocument;
  if (!activeDocument) throw new TypeError("Active document is required");
  const nextDocument = { ...activeDocument, mode };
  testState.workspace.activeDocument = nextDocument;
  testState.workspace.openDocuments = [nextDocument];
}

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    destroy: vi.fn(),
    onCloseRequested: vi.fn().mockResolvedValue(vi.fn()),
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => dialog);

vi.mock("@/lib/native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/native")>()),
  printDocument: native.printDocument,
  readDocumentBaseline: native.readDocumentBaseline,
  readDocumentImage: native.readDocumentImage,
  resolveLibraryRoot: native.resolveLibraryRoot,
  scanDocsRoot: native.scanDocsRoot,
}));

vi.mock("@/hooks/useLibraryWorkspace", () => ({
  runCloseBarrier: vi.fn(),
  useLibraryWorkspace: (_root: string, options: WorkspaceOptions) => {
    testState.workspaceOptions.push(options);
    if (options.onSessionChange) {
      testState.sessionChanges.push(options.onSessionChange);
    }
    return testState.workspace;
  },
}));

vi.mock("@/lib/settings", () => ({
  loadSettings: vi.fn(() => Promise.resolve(testState.settings)),
  nextPaneLayout: vi.fn(),
  saveSettings: vi.fn(),
}));

import { NativeCommandError } from "@/lib/native";
import { saveSettings } from "@/lib/settings";
import { App } from "./App";

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(saveSettings).mockReset();
  vi.mocked(saveSettings).mockResolvedValue(undefined);
  native.readDocumentImage.mockResolvedValue({
    bytes: [137, 80, 78, 71],
    mimeType: "image/png",
  });
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: vi.fn(() => "blob:local-markdown-image"),
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: vi.fn(),
  });
  native.printDocument.mockResolvedValue(undefined);
  native.readDocumentBaseline.mockResolvedValue({
    content: null,
    status: "unavailable",
  });
  native.resolveLibraryRoot.mockImplementation(async (path) => path);
  testState.settings.libraryRoot = "/intent";
  testState.settings.docsRoots = [{ root: "/docs", label: null }];
  testState.settings.docsRoot = "/docs";
  testState.settings.theme = "light";
  testState.settings.spacePalette = "classic";
  testState.settings.language = "ko";
  testState.settings.writingFont = "sans";
  testState.settings.activeSpace = "intent";
  testState.settings.folderPaneOpen = true;
  testState.settings.listPaneOpen = true;
  testState.settings.documentDensity = "full";
  testState.settings.documentSort = "updated";
  testState.settings.tabSessions.intent = { paths: [], activePath: null };
  testState.settings.tabSessions.docs = {
    "/docs": { paths: [], activePath: null },
  };
  testState.sessionChanges.length = 0;
  testState.workspaceOptions.length = 0;
  testState.workspace.openDocuments = [];
  testState.workspace.visibleDocuments = [];
  testState.workspace.activePath = null;
  testState.workspace.activeDocument = null;
  testState.workspace.saveStatus = "idle";
  testState.workspace.reloadingCurrentDocument = false;
  testState.workspace.errorMessage = null;
  testState.workspace.rootUnavailable = false;
  vi.mocked(testState.workspace.persistAllOpenDocuments).mockResolvedValue(
    true,
  );
  mediaState.matchesByQuery.clear();
  mediaState.lists.length = 0;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => {
      const list: MediaQueryListState = {
        query,
        matches: mediaState.matchesByQuery.get(query) ?? false,
        registrations: new Map<MediaListener, number>(),
        removals: new Map<MediaListener, number>(),
      };
      mediaState.lists.push(list);
      return {
        get matches() {
          return list.matches;
        },
        addEventListener: vi.fn((_: string, listener: MediaListener) => {
          list.registrations.set(
            listener,
            (list.registrations.get(listener) ?? 0) + 1,
          );
        }),
        removeEventListener: vi.fn((_: string, listener: MediaListener) => {
          list.removals.set(listener, (list.removals.get(listener) ?? 0) + 1);
        }),
      };
    }),
  });
});

describe("AI unified folder tabs", () => {
  beforeEach(() => {
    testState.settings.activeSpace = "docs";
    testState.settings.language = "en";
    testState.settings.docsRoots = [];
    testState.settings.docsRoot = null;
    testState.settings.tabSessions.docs = {};
    native.scanDocsRoot.mockResolvedValue({ folders: [], documents: [] });
  });

  it("shows one Open AI folder action on first entry without a mode choice", async () => {
    render(<App />);

    expect(
      await screen.findByRole("button", { name: "Open AI folder" }),
    ).toBeDefined();
    expect(screen.queryByRole("button", { name: "Browse" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pinned" })).toBeNull();
  });

  it("opens a canonical folder only after its preflight scan succeeds", async () => {
    const user = userEvent.setup();
    dialog.open.mockResolvedValue("/chosen");
    native.resolveLibraryRoot.mockResolvedValue("/canonical");
    const snapshot = { folders: [], documents: [] };
    native.scanDocsRoot.mockResolvedValue(snapshot);
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Open AI folder" }),
    );

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          docsRoots: [{ root: "/canonical", label: null }],
          docsRoot: "/canonical",
          tabSessions: expect.objectContaining({
            docs: {
              "/canonical": { paths: [], activePath: null },
            },
          }),
        }),
      ),
    );
    expect(native.scanDocsRoot).toHaveBeenCalledWith("/canonical");
    expect(testState.workspaceOptions.at(-1)).toEqual(
      expect.objectContaining({ initialSnapshot: snapshot }),
    );
  });

  it("preserves the preflight snapshot through StrictMode initialization", async () => {
    const user = userEvent.setup();
    dialog.open.mockResolvedValue("/canonical");
    const snapshot = { folders: [], documents: [] };
    native.scanDocsRoot.mockResolvedValue(snapshot);
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await user.click(
      await screen.findByRole("button", { name: "Open AI folder" }),
    );
    await waitFor(() =>
      expect(testState.workspaceOptions.length).toBeGreaterThanOrEqual(2),
    );

    expect(testState.workspaceOptions.length).toBeGreaterThanOrEqual(2);
    expect(
      testState.workspaceOptions.every(
        ({ initialSnapshot }) => initialSnapshot === snapshot,
      ),
    ).toBe(true);
  });

  it("discards a preflight snapshot when the first root write fails", async () => {
    const user = userEvent.setup();
    dialog.open.mockResolvedValue("/failed");
    const snapshot = { folders: [], documents: [] };
    native.scanDocsRoot.mockResolvedValue(snapshot);
    vi.mocked(saveSettings).mockRejectedValueOnce(new Error("Store failed"));
    const { rerender } = render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Open AI folder" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Store failed",
    );

    testState.settings.docsRoots = [{ root: "/failed", label: null }];
    testState.settings.docsRoot = "/failed";
    rerender(<App />);

    await waitFor(() =>
      expect(testState.workspaceOptions.length).toBeGreaterThan(0),
    );
    expect(testState.workspaceOptions.at(-1)).toEqual(
      expect.objectContaining({ initialSnapshot: undefined }),
    );
  });

  it("does not add a folder when its preflight scan fails", async () => {
    const user = userEvent.setup();
    dialog.open.mockResolvedValue("/missing");
    native.scanDocsRoot.mockRejectedValue(
      new NativeCommandError("invalid-root", "Missing AI folder"),
    );
    render(<App />);

    await user.click(
      await screen.findByRole("button", { name: "Open AI folder" }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Missing AI folder",
    );
    expect(saveSettings).not.toHaveBeenCalled();
  });

  it("keeps the mounted root and marks a failed target unavailable", async () => {
    const user = userEvent.setup();
    testState.settings.docsRoots = [
      { root: "/work/a", label: null },
      { root: "/work/b", label: null },
    ];
    testState.settings.docsRoot = "/work/a";
    native.scanDocsRoot.mockRejectedValue(
      new NativeCommandError("invalid-root", "Missing target"),
    );
    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: "Open AI folder b: /work/b",
      }),
    );

    expect(saveSettings).not.toHaveBeenCalled();
    expect(
      screen
        .getByRole("button", { name: "Open AI folder a: /work/a" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", {
        name: "Open AI folder b: /work/b. Unavailable",
      }),
    ).toBeDefined();
  });

  it("activates an unavailable target only after targeted Refresh succeeds", async () => {
    const user = userEvent.setup();
    testState.settings.docsRoots = [
      { root: "/work/a", label: null },
      { root: "/work/b", label: null },
    ];
    testState.settings.docsRoot = "/work/a";
    native.scanDocsRoot
      .mockRejectedValueOnce(new NativeCommandError("invalid-root", "Missing"))
      .mockResolvedValueOnce({ folders: [], documents: [] });
    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: "Open AI folder b: /work/b",
      }),
    );
    await user.click(
      screen.getByRole("button", { name: "Open actions for b: /work/b" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Refresh" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ docsRoot: "/work/b" }),
      ),
    );
  });

  it("does not switch the mounted workspace when settings persistence fails", async () => {
    const user = userEvent.setup();
    testState.settings.docsRoots = [
      { root: "/work/a", label: null },
      { root: "/work/b", label: null },
    ];
    testState.settings.docsRoot = "/work/a";
    vi.mocked(saveSettings).mockRejectedValueOnce(new Error("Store failed"));
    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: "Open AI folder b: /work/b",
      }),
    );

    await waitFor(() => expect(saveSettings).toHaveBeenCalled());
    expect(
      screen
        .getByRole("button", { name: "Open AI folder a: /work/a" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("pins an unpinned tab at the end of the pinned group without saving documents", async () => {
    const user = userEvent.setup();
    testState.settings.docsRoots = [
      { root: "/work/a", label: "A" },
      { root: "/work/b", label: null },
      { root: "/work/c", label: null },
    ];
    testState.settings.docsRoot = "/work/b";
    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: "Pin AI folder b: /work/b",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Save label" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          docsRoots: [
            { root: "/work/a", label: "A" },
            { root: "/work/b", label: "b" },
            { root: "/work/c", label: null },
          ],
        }),
      ),
    );
    expect(testState.workspace.persistAllOpenDocuments).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", {
          name: "Unpin AI folder b: /work/b",
        }),
      ),
    );
  });

  it("restores focus to the direct Pin toggle after cancelling", async () => {
    const user = userEvent.setup();
    testState.settings.docsRoots = [{ root: "/work/a", label: null }];
    testState.settings.docsRoot = "/work/a";
    render(<App />);

    const pin = await screen.findByRole("button", {
      name: "Pin AI folder a: /work/a",
    });
    await user.click(pin);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(document.activeElement).toBe(pin));
  });

  it("unpins to the front of the unpinned group without removing its session", async () => {
    const user = userEvent.setup();
    testState.settings.docsRoots = [
      { root: "/work/a", label: "A" },
      { root: "/work/b", label: "B" },
      { root: "/work/c", label: null },
    ];
    testState.settings.docsRoot = "/work/a";
    testState.settings.tabSessions.docs = {
      "/work/a": { paths: ["a.md"], activePath: "a.md" },
    };
    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: "Unpin AI folder a: /work/a",
      }),
    );

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          docsRoots: [
            { root: "/work/b", label: "B" },
            { root: "/work/a", label: null },
            { root: "/work/c", label: null },
          ],
          tabSessions: expect.objectContaining({
            docs: {
              "/work/a": { paths: ["a.md"], activePath: "a.md" },
            },
          }),
        }),
      ),
    );
  });

  it("edits only the pin label and preserves root-local session identity", async () => {
    const user = userEvent.setup();
    testState.settings.docsRoots = [{ root: "/work/a", label: "A" }];
    testState.settings.docsRoot = "/work/a";
    testState.settings.tabSessions.docs = {
      "/work/a": { paths: ["a.md"], activePath: "a.md" },
    };
    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: "Open actions for a: /work/a",
      }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Edit label" }));
    const input = screen.getByRole("textbox", {
      name: "One or two characters",
    });
    await user.clear(input);
    await user.type(input, "AX");
    await user.click(screen.getByRole("button", { name: "Save label" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          docsRoots: [{ root: "/work/a", label: "AX" }],
          tabSessions: expect.objectContaining({
            docs: {
              "/work/a": { paths: ["a.md"], activePath: "a.md" },
            },
          }),
        }),
      ),
    );
  });

  it("restores label focus through the current root row when the opener is replaced", async () => {
    const user = userEvent.setup();
    let resolveSave: (() => void) | undefined;
    vi.mocked(saveSettings).mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    testState.settings.docsRoots = [{ root: "/work/a", label: "A" }];
    testState.settings.docsRoot = "/work/a";
    render(<App />);

    const opener = await screen.findByRole("button", {
      name: "Open actions for a: /work/a",
    });
    await user.click(opener);
    await user.click(screen.getByRole("menuitem", { name: "Edit label" }));
    const input = screen.getByRole("textbox", {
      name: "One or two characters",
    });
    await user.clear(input);
    await user.type(input, "AX");
    await user.click(screen.getByRole("button", { name: "Save label" }));
    await waitFor(() => expect(saveSettings).toHaveBeenCalled());

    const replacement = document.createElement("button");
    replacement.className = "docs-root-actions";
    replacement.type = "button";
    opener.replaceWith(replacement);
    resolveSave?.();

    await waitFor(() => expect(document.activeElement).toBe(replacement));
  });

  it("closes an active unpinned tab to the right without scanning and deletes only its session", async () => {
    const user = userEvent.setup();
    testState.settings.docsRoots = [
      { root: "/work/a", label: "A" },
      { root: "/work/b", label: null },
      { root: "/work/c", label: null },
    ];
    testState.settings.docsRoot = "/work/b";
    testState.settings.tabSessions.docs = {
      "/work/b": { paths: ["b.md"], activePath: "b.md" },
      "/work/c": { paths: ["c.md"], activePath: "c.md" },
    };
    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: "Open actions for b: /work/b",
      }),
    );
    native.scanDocsRoot.mockClear();
    await user.click(screen.getByRole("menuitem", { name: "Close" }));

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          docsRoots: [
            { root: "/work/a", label: "A" },
            { root: "/work/c", label: null },
          ],
          docsRoot: "/work/c",
          tabSessions: expect.objectContaining({
            docs: {
              "/work/c": { paths: ["c.md"], activePath: "c.md" },
            },
          }),
        }),
      ),
    );
    expect(
      vi.mocked(saveSettings).mock.calls.at(-1)?.[0].tabSessions.docs,
    ).toEqual({
      "/work/c": { paths: ["c.md"], activePath: "c.md" },
    });
    expect(native.scanDocsRoot).not.toHaveBeenCalled();
  });

  it("recovers startup to the first available root without deleting the missing tab", async () => {
    testState.settings.docsRoots = [
      { root: "/missing", label: "M" },
      { root: "/available", label: null },
    ];
    testState.settings.docsRoot = "/missing";
    testState.workspace.rootUnavailable = true;
    native.scanDocsRoot.mockResolvedValue({ folders: [], documents: [] });
    render(<App />);

    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          docsRoot: "/available",
          docsRoots: testState.settings.docsRoots,
        }),
      ),
    );
  });
});

describe("FolderTree collapsible mode", () => {
  const folders = [
    { path: "projects", parent: "", name: "projects" },
    { path: "projects/current", parent: "projects", name: "current" },
    {
      path: "projects/current/child",
      parent: "projects/current",
      name: "child",
    },
    { path: "other", parent: "", name: "other" },
  ];
  const actions = {
    onMove: vi.fn(),
    onRename: vi.fn(),
    onSelect: vi.fn(),
    onToggleExpanded: vi.fn(),
    onTrash: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows first-level folders and expands descendants from a separate control", () => {
    // Given: a collapsed Pinned folder tree.
    const { container, rerender } = render(
      <FolderTree
        {...actions}
        collapsible
        expandedPaths={new Set<string>()}
        folders={folders}
        readOnly
        rootName="task-a"
        selectedPath=""
      />,
    );
    expect(screen.getByText("projects")).not.toBeNull();
    expect(screen.getByText("other")).not.toBeNull();
    expect(screen.queryByText("current")).toBeNull();

    // When: the projects chevron is activated.
    const toggle = container.querySelector<HTMLButtonElement>(
      'button[aria-expanded="false"]',
    );
    if (!toggle) throw new TypeError("Expected a folder toggle");
    fireEvent.click(toggle);

    // Then: toggling does not select, and controlled expansion reveals descendants.
    expect(actions.onToggleExpanded).toHaveBeenCalledWith("projects");
    expect(actions.onSelect).not.toHaveBeenCalled();
    expect(toggle.getAttribute("aria-label")).not.toBe("projects");
    rerender(
      <FolderTree
        {...actions}
        collapsible
        expandedPaths={new Set(["projects"])}
        folders={folders}
        readOnly
        rootName="task-a"
        selectedPath=""
      />,
    );
    expect(screen.getByText("current")).not.toBeNull();
    expect(screen.queryByText("child")).toBeNull();
  });

  it("keeps the default tree always expanded", () => {
    // Given / When: the existing non-collapsible tree renders.
    render(
      <FolderTree
        {...actions}
        folders={folders}
        readOnly
        rootName="Human"
        selectedPath=""
      />,
    );

    // Then: all descendants remain visible without expansion state.
    expect(screen.getByText("current")).not.toBeNull();
    expect(screen.getByText("child")).not.toBeNull();
  });
});

describe("document list controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.workspace.visibleDocuments = [
      { path: "문서10.md", parent: "", title: "문서10", updatedMs: 30 },
      { path: "b/문서2.md", parent: "", title: "문서2", updatedMs: 20 },
      { path: "a/문서2.md", parent: "", title: "문서2", updatedMs: 10 },
    ];
    testState.workspace.visibleSnippets = new Map([
      ["문서10.md", "열 번째 문서 내용"],
      ["b/문서2.md", "두 번째 문서 내용"],
      ["a/문서2.md", "다른 두 번째 문서 내용"],
    ]);
  });

  it("sorts titles with numeric collation and a path tie-break", async () => {
    // Given: title sorting is persisted for Korean documents.
    testState.settings.documentSort = "title";

    // When: the document list renders.
    render(<App />);
    const list = await screen.findByRole("listbox", { name: "Markdown 문서" });

    // Then: numeric titles and equal-title paths use a stable order.
    expect(
      [...list.querySelectorAll(".document-row strong")].map(
        (node) => node.textContent,
      ),
    ).toEqual(["문서2", "문서2", "문서10"]);
    fireEvent.click(list.querySelectorAll<HTMLElement>(".document-row")[0]);
    expect(testState.workspace.openDocument).toHaveBeenCalledWith("a/문서2.md");
  });

  it("toggles the global sort preference", async () => {
    // Given: documents are currently sorted by latest update.
    const user = userEvent.setup();
    render(<App />);

    // When: the title-sort toggle is activated.
    await user.click(
      await screen.findByRole("button", {
        name: "현재 최신 순 · 클릭하면 제목 순",
      }),
    );

    // Then: the single global preference is persisted as title order.
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ documentSort: "title" }),
    );
  });

  it("refreshes the current folder scan", async () => {
    // Given: the document list is visible.
    const user = userEvent.setup();
    render(<App />);

    // When: refresh is activated.
    await user.click(
      await screen.findByRole("button", { name: "문서 목록 새로 고침" }),
    );

    // Then: the existing workspace refresh boundary is called.
    expect(testState.workspace.refresh).toHaveBeenCalledOnce();
  });

  it("cycles Full, Medium, and Simple document row details", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    await screen.findByRole("listbox", { name: "Markdown 문서" });
    const rows = () => [...container.querySelectorAll(".document-row")];

    expect(
      rows().every((row) => row.getAttribute("data-density") === "full"),
    ).toBe(true);
    expect(container.querySelectorAll(".document-snippet")).toHaveLength(3);
    expect(container.querySelectorAll(".document-row time")).toHaveLength(3);

    await user.click(
      await screen.findByRole("button", {
        name: "현재 Full · 클릭하면 Medium",
      }),
    );
    await waitFor(() =>
      expect(
        rows().every((row) => row.getAttribute("data-density") === "medium"),
      ).toBe(true),
    );
    expect(container.querySelectorAll(".document-snippet")).toHaveLength(3);
    expect(container.querySelectorAll(".document-row time")).toHaveLength(0);

    await user.click(
      screen.getByRole("button", {
        name: "현재 Medium · 클릭하면 Simple",
      }),
    );
    await waitFor(() =>
      expect(
        rows().every((row) => row.getAttribute("data-density") === "simple"),
      ).toBe(true),
    );
    expect(container.querySelectorAll(".document-snippet")).toHaveLength(0);
    expect(container.querySelectorAll(".document-row time")).toHaveLength(0);

    await user.click(
      screen.getByRole("button", {
        name: "현재 Simple · 클릭하면 Full",
      }),
    );
    await waitFor(() =>
      expect(
        rows().every((row) => row.getAttribute("data-density") === "full"),
      ).toBe(true),
    );
    expect(vi.mocked(saveSettings).mock.calls.map(([value]) => value)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ documentDensity: "medium" }),
        expect.objectContaining({ documentDensity: "simple" }),
        expect.objectContaining({ documentDensity: "full" }),
      ]),
    );
  });
});

describe("root selection onboarding", () => {
  it("completes after language, theme, and the required Human folder", async () => {
    testState.settings.libraryRoot = null;
    testState.settings.docsRoots = [];
    testState.settings.docsRoot = null;
    testState.settings.language = "ko";
    testState.settings.spacePalette = "plum-moss";
    dialog.open.mockResolvedValueOnce("/memo/intent");
    const user = userEvent.setup();
    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Choose the language you want to use",
      }),
    ).toBeDefined();
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ language: "en" }),
    );
    await user.click(screen.getByRole("radio", { name: "한국어" }));
    await user.click(screen.getByRole("button", { name: "계속" }));
    expect(
      await screen.findByRole("heading", {
        name: "편안한 테마를 선택하세요",
      }),
    ).toBeDefined();
    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          spacePalette: "classic",
          theme: "charcoal",
        }),
      ),
    );
    expect(screen.getByRole("group", { name: "Human·AI 색상" })).toBeDefined();
    await user.click(screen.getByRole("radio", { name: "플럼 & 모스" }));
    await user.click(screen.getByRole("button", { name: "계속" }));
    await user.click(
      await screen.findByRole("button", { name: "Human folder 선택" }),
    );

    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        libraryRoot: "/memo/intent",
        docsRoot: null,
        activeSpace: "intent",
        spacePalette: "plum-moss",
      }),
    );
    expect(screen.queryByText("AI folder 선택")).toBeNull();
  });

  it("applies skip defaults without introducing an AI folder step", async () => {
    testState.settings.libraryRoot = null;
    testState.settings.docsRoots = [];
    testState.settings.docsRoot = null;
    testState.settings.spacePalette = "plum-moss";
    dialog.open.mockResolvedValueOnce("/memo/intent");
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Skip" }));
    expect(
      await screen.findByRole("heading", {
        name: "Choose a comfortable theme",
      }),
    ).toBeDefined();
    await waitFor(() =>
      expect(saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          spacePalette: "classic",
          theme: "charcoal",
        }),
      ),
    );
    await user.click(await screen.findByRole("button", { name: "Skip" }));
    await user.click(
      await screen.findByRole("button", { name: "Choose Human folder" }),
    );

    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSpace: "intent",
        libraryRoot: "/memo/intent",
        docsRoot: null,
        language: "en",
        spacePalette: "classic",
        theme: "charcoal",
      }),
    );
  });

  it("restarts onboarding whenever the required Human root is missing", async () => {
    testState.settings.libraryRoot = null;
    testState.settings.docsRoots = [{ root: "/memo/docs", label: null }];
    testState.settings.docsRoot = "/memo/docs";

    render(<App />);

    expect(
      await screen.findByRole("heading", {
        name: "Choose the language you want to use",
      }),
    ).toBeDefined();
    expect(screen.getByText("Step 1 of 3")).toBeDefined();
  });
});

describe("runtime theme", () => {
  it.each([
    "light",
    "charcoal",
    "dark",
  ] as const)("applies the %s theme to the document", async (theme) => {
    testState.settings.theme = theme;

    render(<App />);

    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe(theme),
    );
  });

  it("tracks OS preference changes for the system theme", async () => {
    testState.settings.theme = "system";
    const { unmount } = render(<App />);
    const themeLists = () =>
      mediaState.lists.filter(
        ({ query }) => query === "(prefers-color-scheme: dark)",
      );

    await waitFor(() => {
      expect(
        themeLists().map((list) => [...list.registrations.values()]),
      ).toEqual([[1], [1]]);
      expect(themeLists().map((list) => [...list.removals.values()])).toEqual([
        [1],
        [],
      ]);
    });
    expect(document.documentElement.dataset.theme).toBe("light");
    mediaState.matchesByQuery.set("(prefers-color-scheme: dark)", true);
    act(() => {
      for (const list of themeLists()) {
        list.matches = true;
        for (const [listener, registrations] of list.registrations) {
          if (registrations > (list.removals.get(listener) ?? 0)) {
            listener();
          }
        }
      }
    });
    expect(document.documentElement.dataset.theme).toBe("dark");

    expect(themeLists().map((list) => [...list.removals.values()])).toEqual([
      [1],
      [],
    ]);
    unmount();
    expect(themeLists().map((list) => [...list.removals.values()])).toEqual([
      [1],
      [1],
    ]);
  });
});

describe("runtime space palette", () => {
  it.each([
    "classic",
    "terracotta-teal",
    "plum-moss",
    "mono-duo",
  ] as const)("applies the %s palette to the document", async (spacePalette) => {
    // Given: settings contain one supported Human/AI palette.
    testState.settings.spacePalette = spacePalette;

    // When: the runtime renders those settings.
    render(<App />);

    // Then: CSS can resolve the selected raw palette tokens globally.
    await waitFor(() =>
      expect(document.documentElement.dataset.spacePalette).toBe(spacePalette),
    );
  });
});

describe("folder move destinations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("excludes the current parent, self, and descendants while preserving other folders", async () => {
    const user = userEvent.setup();
    render(<App />);
    const currentFolder = await screen.findByRole("button", {
      name: "current",
    });

    fireEvent.contextMenu(currentFolder);
    await user.click(screen.getByRole("menuitem", { name: "이동…" }));

    expect(screen.queryByRole("option", { name: "projects" })).toBeNull();
    expect(screen.queryByRole("option", { name: "current" })).toBeNull();
    expect(screen.queryByRole("option", { name: "child" })).toBeNull();
    expect(screen.getByRole("option", { name: "intent" })).toBeDefined();
    expect(screen.getByRole("option", { name: "sibling" })).toBeDefined();
    expect(screen.getByRole("option", { name: "other" })).toBeDefined();
  });
});

describe("AI folder workspace", () => {
  const first = {
    root: "/docs",
    path: "a.md",
    title: "First",
    created: "2026-08-07T00:00:00.000Z",
    updated: "2026-08-07T00:00:00.000Z",
    body: "A",
    mtimeMs: 1,
    mode: "view" as const,
    saveStatus: "saved" as const,
  };
  const second = {
    ...first,
    path: "plans/b.md",
    title: "Second",
    body: "B",
  };

  beforeEach(() => {
    testState.settings.activeSpace = "docs";
    testState.settings.docsRoots = [{ root: "/docs", label: null }];
    testState.settings.docsRoot = "/docs";
    testState.settings.tabSessions.docs = {
      "/docs": {
        paths: [first.path, second.path],
        activePath: first.path,
      },
    };
    testState.workspace.openDocuments = [first, second];
    testState.workspace.activeDocument = first;
    testState.workspace.activePath = first.path;
    testState.workspace.snapshot = {
      ...testState.workspace.snapshot,
      documents: [
        { path: "a.md", parent: "", title: "First", updatedMs: 1 },
        { path: "plans/b.md", parent: "plans", title: "Second", updatedMs: 1 },
      ],
    };
  });

  it("renders one-line root-local AI tabs and the unified folder card", async () => {
    const { container } = render(<App />);

    const firstTab = await screen.findByRole("tab", {
      name: "First, /docs/a.md",
    });
    expect(firstTab.querySelector(".tab-source-label")).toBeNull();
    expect(firstTab.querySelector(".tab-path")).toBeNull();
    expect(firstTab.getAttribute("title")).toBe("/docs/a.md");
    expect(container.querySelectorAll(".source-card")).toHaveLength(1);
    expect(container.querySelectorAll(".docs-root-shortcut")).toHaveLength(0);
    expect(
      screen.getByRole("button", { name: "AI 폴더 docs 열기: /docs" }),
    ).toBeDefined();
  });

  it("shows the compact document path above the rendered AI body", async () => {
    const { container } = render(<App />);

    await screen.findByRole("tab", { name: "First, /docs/a.md" });
    const pathLine = container.querySelector(".markdown-view .document-path");
    expect(pathLine?.textContent).toBe("…/docs/a.md");
    expect(pathLine?.getAttribute("title")).toBe("/docs/a.md");
    expect(pathLine?.parentElement?.firstElementChild).toBe(pathLine);
  });

  it("renders a combined root-aware Explorer and opens a selected file", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole("button", { name: "docs" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "First" }));
    expect(testState.workspace.openDocument).toHaveBeenCalledWith("a.md");
  });

  it("keeps AI structural mutation actions unavailable", async () => {
    testState.workspace.visibleDocuments = [
      { path: "a.md", parent: "", title: "First", updatedMs: 1 },
    ];
    render(<App />);
    const documentRow = await screen.findByRole("option", { name: /First/ });

    fireEvent.contextMenu(documentRow);

    expect(screen.queryByRole("menuitem", { name: "이름 변경…" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "이동…" })).toBeNull();
    expect(
      screen.queryByRole("menuitem", { name: "휴지통으로 이동" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "새 모음" })).toBeNull();
  });

  it("cycles an AI document from View using the far-right mode control", async () => {
    const user = userEvent.setup();
    vi.mocked(testState.workspace.setMode).mockImplementation(setWorkspaceMode);
    const { rerender } = render(<App />);

    let modeButton = await screen.findByRole("button", {
      name: "현재 View · 클릭하면 Edit | View 분할",
    });
    await user.click(modeButton);
    expect(testState.workspace.setMode).toHaveBeenNthCalledWith(1, "split");

    rerender(<App />);
    modeButton = screen.getByRole("button", {
      name: "현재 Edit | View 분할 · 클릭하면 Edit",
    });
    await user.click(modeButton);
    expect(testState.workspace.setMode).toHaveBeenNthCalledWith(2, "edit");
  });

  it("shows AI save status immediately before the mode control", async () => {
    testState.workspace.saveStatus = "saving";
    const { container } = render(<App />);

    const modeButton = await screen.findByRole("button", {
      name: "현재 View · 클릭하면 Edit | View 분할",
    });
    const status = container.querySelector(".tab-bar-actions .save-status");
    expect(status?.textContent).toBe("저장 중");
    expect(status?.nextElementSibling).toBe(modeButton);
  });
});

describe("content toolbar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.settings.activeSpace = "intent";
    testState.settings.folderPaneOpen = true;
    testState.settings.listPaneOpen = true;
    const document = {
      root: "/intent",
      path: "hybrid.md",
      title: "hybrid",
      created: "2026-08-07T00:00:00.000Z",
      updated: "2026-08-07T00:00:00.000Z",
      body: "Human intent",
      mtimeMs: 1,
      mode: "edit" as const,
      saveStatus: "saved" as const,
    };
    testState.workspace.openDocuments = [document];
    testState.workspace.activePath = document.path;
    testState.workspace.activeDocument = document;
    testState.workspace.saveStatus = "saved";
  });

  it("keeps the pane control before tabs and cycles mode from the far right", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const modeButton = await screen.findByRole("button", {
      name: "현재 Edit · 클릭하면 View",
    });
    const tab = screen.getByRole("tab", { name: "hybrid" });
    const closeButton = screen.getByRole("button", { name: "hybrid 탭 닫기" });
    const tabBar = container.querySelector(".tab-bar");
    const actions = container.querySelector(".tab-bar-actions");
    const leading = container.querySelector(".tab-bar-leading");
    const layoutButton = screen.getByRole("button", {
      name: "현재 3-pane · 클릭하면 folder pane 닫기",
    });

    expect(tabBar).not.toBeNull();
    expect(tabBar?.classList.contains("has-docs-tab")).toBe(false);
    expect(leading?.parentElement).toBe(tabBar);
    expect(leading?.nextElementSibling?.classList.contains("tab-list")).toBe(
      true,
    );
    expect(layoutButton.parentElement).toBe(leading);
    expect(actions?.parentElement).toBe(tabBar);
    expect(actions?.lastElementChild).toBe(modeButton);
    expect(actions?.children).toHaveLength(3);
    expect(leading?.children).toHaveLength(1);
    expect(layoutButton.classList.contains("header-cycle-button")).toBe(true);
    expect(modeButton.classList.contains("header-cycle-button")).toBe(true);
    expect(actions?.querySelector(".save-status")).toBeNull();
    expect(tab.parentElement?.getAttribute("role")).toBe("presentation");
    expect(tab.querySelector(".tab-source-label")).toBeNull();
    expect(closeButton.parentElement).toBe(tab.parentElement);
    expect(layoutButton.textContent).toBe("");
    expect(modeButton.textContent).toBe("");
    expect(tabBar?.querySelector(".space-switcher-compact")).toBeNull();
    expect(
      container.querySelector(".window-titlebar-service")?.textContent,
    ).toBe("Tasteful Intent");
    expect(
      container.querySelector(".window-titlebar-document")?.textContent,
    ).toBe("hybrid");

    await user.click(modeButton);
    expect(testState.workspace.setMode).toHaveBeenCalledWith("view");
  });

  it("keeps the document path line out of the Human view surface", async () => {
    const { container } = render(<App />);

    await screen.findByRole("button", { name: "현재 Edit · 클릭하면 View" });
    expect(container.querySelector(".markdown-view .document-path")).toBeNull();
  });

  it("reloads the active Human document before the save status and mode action", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const reloadButton = await screen.findByRole("button", {
      name: "현재 문서 다시 불러오기",
    });
    const modeButton = screen.getByRole("button", {
      name: "현재 Edit · 클릭하면 View",
    });
    const actions = container.querySelector(".tab-bar-actions");

    expect(actions?.firstElementChild).toBe(reloadButton);
    expect(actions?.lastElementChild).toBe(modeButton);
    await user.click(reloadButton);
    expect(testState.workspace.reloadCurrentDocument).toHaveBeenCalledOnce();
  });

  it("exports the rendered active document through the system PDF dialog", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const exportButton = await screen.findByRole("button", {
      name: "현재 문서를 PDF로 내보내기",
    });
    const actions = container.querySelector(".tab-bar-actions");

    expect(actions?.children[1]).toBe(exportButton);
    expect(container.querySelector(".markdown-view.print-only")).not.toBeNull();
    await user.click(exportButton);

    expect(native.printDocument).toHaveBeenCalledOnce();
  });

  it("shows PDF export failures in the inline error notice", async () => {
    const user = userEvent.setup();
    native.printDocument.mockRejectedValueOnce(
      new NativeCommandError("print-failed", "PDF export failed"),
    );
    render(<App />);

    await user.click(
      await screen.findByRole("button", {
        name: "현재 문서를 PDF로 내보내기",
      }),
    );

    expect((await screen.findByRole("alert")).textContent).toContain(
      "PDF export failed",
    );
  });

  it("disables reload while the current document is saving or reloading", async () => {
    testState.workspace.saveStatus = "saving";
    const { rerender } = render(<App />);
    const savingReload = await screen.findByRole("button", {
      name: "현재 문서 다시 불러오기",
    });
    expect(savingReload).toHaveProperty("disabled", true);

    testState.workspace.saveStatus = "saved";
    testState.workspace.reloadingCurrentDocument = true;
    rerender(<App />);
    expect(
      screen.getByRole("button", { name: "현재 문서 다시 불러오기" }),
    ).toHaveProperty("disabled", true);
  });

  it("does not show reload when there is no active document", () => {
    testState.workspace.openDocuments = [];
    testState.workspace.activePath = null;
    testState.workspace.activeDocument = null;
    render(<App />);

    expect(
      screen.queryByRole("button", { name: "현재 문서 다시 불러오기" }),
    ).toBeNull();
  });

  it("shows save status only while the document needs attention", async () => {
    // Given: the active document is being saved.
    testState.workspace.saveStatus = "saving";

    // When: the content toolbar renders.
    const { container } = render(<App />);
    await screen.findByRole("button", {
      name: "현재 Edit · 클릭하면 View",
    });

    // Then: the transient status remains visible outside the fixed cycle cell.
    expect(container.querySelector(".save-status")?.textContent).toBe(
      "저장 중",
    );
  });

  it("does not add space or root labels when navigation panes are hidden", async () => {
    testState.settings.folderPaneOpen = false;
    testState.settings.listPaneOpen = false;
    const { container } = render(<App />);

    await screen.findByRole("button", { name: "현재 Edit · 클릭하면 View" });
    expect(container.querySelector(".active-root")).toBeNull();
    expect(container.querySelector(".space-switcher-compact")).toBeNull();
  });

  it.each([
    {
      mode: "view",
      label: "현재 View · 클릭하면 Edit | View 분할",
      next: "split",
    },
    {
      mode: "split",
      label: "현재 Edit | View 분할 · 클릭하면 Edit",
      next: "edit",
    },
  ] satisfies readonly {
    readonly mode: EditorMode;
    readonly label: string;
    readonly next: EditorMode;
  }[])("cycles $mode mode to $next", async ({ mode, label, next }) => {
    const user = userEvent.setup();
    setWorkspaceMode(mode);
    render(<App />);

    await user.click(await screen.findByRole("button", { name: label }));
    expect(testState.workspace.setMode).toHaveBeenCalledWith(next);
  });

  it("renders editor and view as two columns in split mode", async () => {
    setWorkspaceMode("split");
    const { container } = render(<App />);

    await screen.findByLabelText("Markdown 본문");
    expect(
      container.querySelector(".document-surface.is-split"),
    ).not.toBeNull();
    expect(container.querySelector(".editor-surface")).not.toBeNull();
    expect(container.querySelector(".markdown-view")?.textContent).toContain(
      "Human intent",
    );
  });

  it("loads a relative Markdown image through the active document root", async () => {
    setWorkspaceMode("view");
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    testState.workspace.activeDocument = {
      ...activeDocument,
      path: "plans/cycle.md",
      body: "![Cycle](../images/cycle.png)",
    };
    testState.workspace.openDocuments = [testState.workspace.activeDocument];

    render(<App />);

    const image = await screen.findByRole("img", { name: "Cycle" });
    await waitFor(() =>
      expect(image.getAttribute("src")).toBe("blob:local-markdown-image"),
    );
    expect(native.readDocumentImage).toHaveBeenCalledWith(
      "/intent",
      "plans/cycle.md",
      "../images/cycle.png",
    );
  });

  it("finds the current document with Ctrl+F and wraps keyboard navigation", async () => {
    const user = userEvent.setup();
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    testState.workspace.activeDocument = {
      ...activeDocument,
      body: "Human intent and another human note",
    };
    testState.workspace.openDocuments = [testState.workspace.activeDocument];
    render(<App />);
    const modeButton = await screen.findByRole("button", {
      name: "현재 Edit · 클릭하면 View",
    });
    modeButton.focus();

    await user.keyboard("{Control>}f{/Control}");
    const searchbox = await screen.findByRole("searchbox", {
      name: "현재 문서 검색",
    });
    expect(document.activeElement).toBe(searchbox);
    await user.type(searchbox, "human");
    expect(screen.getByRole("status").textContent).toBe("1/2");

    await user.keyboard("{Enter}");
    expect(screen.getByRole("status").textContent).toBe("2/2");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("status").textContent).toBe("1/2");
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(screen.getByRole("status").textContent).toBe("2/2");

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("searchbox", { name: "현재 문서 검색" }),
    ).toBeNull();
    expect(document.activeElement).toBe(modeButton);
  });

  it("finds and marks the active AI View document with Command+F", async () => {
    const user = userEvent.setup();
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    const aiDocument = {
      ...activeDocument,
      root: "/docs",
      path: "result.md",
      title: "result",
      body: "Result text and another result",
      mode: "view" as const,
    };
    testState.settings.activeSpace = "docs";
    testState.workspace.activeDocument = aiDocument;
    testState.workspace.openDocuments = [aiDocument];
    testState.workspace.activePath = aiDocument.path;
    testState.settings.tabSessions.docs = {
      "/docs": {
        paths: [aiDocument.path],
        activePath: aiDocument.path,
      },
    };
    const { container } = render(<App />);
    await screen.findByText("Result text and another result");

    await user.keyboard("{Meta>}f{/Meta}");
    const searchbox = await screen.findByRole("searchbox", {
      name: "현재 문서 검색",
    });
    fireEvent.change(searchbox, { target: { value: "result" } });

    expect(screen.getByRole("status").textContent).toBe("1/2");
    expect(container.querySelectorAll("mark.document-find-match")).toHaveLength(
      2,
    );
    expect(container.querySelectorAll("mark.is-active")).toHaveLength(1);
  });

  it("AI View에서 baseline이 있으면 diff 토글을 노출하고 diff surface로 전환한다", async () => {
    const user = userEvent.setup();
    native.readDocumentBaseline.mockResolvedValue({
      content:
        "---\ncreated: 2026-08-01T00:00:00.000Z\nupdated: 2026-08-01T00:00:00.000Z\n---\n\nold body\n",
      status: "baseline",
    });
    testState.settings.activeSpace = "docs";
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
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
      screen.getByRole("button", { name: "현재 변경만 · 클릭하면 전체 문서" }),
    ).toBeTruthy();
    expect(
      container
        .querySelector("article.markdown-view")
        ?.classList.contains("print-only"),
    ).toBe(true);
    expect(
      container.querySelector(".document-diff-view")?.textContent,
    ).not.toContain("created:");
  });

  // `MarkdownView` is the only surface that highlights and scrolls find
  // results, and diff mode hides it behind `print-only`. Find and diff are
  // therefore mutually exclusive: whichever the user opens closes the other,
  // so a visible match count always has a visible match behind it.
  it("Find를 열면 diff surface를 닫고 본문 하이라이트를 유지한다", async () => {
    const user = userEvent.setup();
    native.readDocumentBaseline.mockResolvedValue({
      content:
        "---\ncreated: 2026-08-01T00:00:00.000Z\nupdated: 2026-08-01T00:00:00.000Z\n---\n\nold result\n",
      status: "baseline",
    });
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    const aiDocument = {
      ...activeDocument,
      root: "/docs",
      path: "result.md",
      title: "result",
      body: "Result text and another result",
      mode: "view" as const,
    };
    testState.settings.activeSpace = "docs";
    testState.workspace.activeDocument = aiDocument;
    testState.workspace.openDocuments = [aiDocument];
    testState.workspace.activePath = aiDocument.path;
    testState.settings.tabSessions.docs = {
      "/docs": { paths: [aiDocument.path], activePath: aiDocument.path },
    };

    const { container } = render(<App />);
    const toggle = await screen.findByRole("button", {
      name: "마지막 commit 이후 변경 보기",
    });
    await user.click(toggle);
    expect(container.querySelector(".document-diff-view")).not.toBeNull();

    await user.keyboard("{Meta>}f{/Meta}");
    const searchbox = await screen.findByRole("searchbox", {
      name: "현재 문서 검색",
    });
    fireEvent.change(searchbox, { target: { value: "result" } });

    // Opening Find drops diff back to `off` so the rendered body is visible.
    expect(container.querySelector(".document-diff-view")).toBeNull();
    expect(
      container
        .querySelector(".markdown-view")
        ?.classList.contains("print-only"),
    ).toBe(false);
    expect(screen.getByRole("status").textContent).toBe("1/2");
    expect(container.querySelectorAll("mark.document-find-match")).toHaveLength(
      2,
    );
    expect(container.querySelectorAll("mark.is-active")).toHaveLength(1);
  });

  it("Find가 열린 상태에서 diff를 켜면 Find overlay를 닫는다", async () => {
    const user = userEvent.setup();
    native.readDocumentBaseline.mockResolvedValue({
      content:
        "---\ncreated: 2026-08-01T00:00:00.000Z\nupdated: 2026-08-01T00:00:00.000Z\n---\n\nold result\n",
      status: "baseline",
    });
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    const aiDocument = {
      ...activeDocument,
      root: "/docs",
      path: "result.md",
      title: "result",
      body: "Result text and another result",
      mode: "view" as const,
    };
    testState.settings.activeSpace = "docs";
    testState.workspace.activeDocument = aiDocument;
    testState.workspace.openDocuments = [aiDocument];
    testState.workspace.activePath = aiDocument.path;
    testState.settings.tabSessions.docs = {
      "/docs": { paths: [aiDocument.path], activePath: aiDocument.path },
    };

    const { container } = render(<App />);
    const toggle = await screen.findByRole("button", {
      name: "마지막 commit 이후 변경 보기",
    });
    await user.keyboard("{Meta>}f{/Meta}");
    await screen.findByRole("searchbox", { name: "현재 문서 검색" });

    await user.click(toggle);
    expect(container.querySelector(".document-diff-view")).not.toBeNull();
    expect(
      screen.queryByRole("searchbox", { name: "현재 문서 검색" }),
    ).toBeNull();
  });

  it("diff 토글은 off → changes → full → off 순으로 순환한다", async () => {
    const user = userEvent.setup();
    native.readDocumentBaseline.mockResolvedValue({
      content:
        "---\ncreated: 2026-08-01T00:00:00.000Z\nupdated: 2026-08-01T00:00:00.000Z\n---\n\nold body\n",
      status: "baseline",
    });
    testState.settings.activeSpace = "docs";
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
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
    expect(container.querySelector(".document-diff-view")).toBeNull();
    // The icon has to change with the mode: `changes` and `full` share the
    // active styling, so a single icon left the two states indistinguishable.
    expect(toggle.querySelector(".lucide-file-diff")).not.toBeNull();

    await user.click(toggle);
    expect(
      screen.getByRole("button", { name: "현재 변경만 · 클릭하면 전체 문서" }),
    ).toBe(toggle);
    expect(container.querySelector(".document-diff-view")).not.toBeNull();
    expect(toggle.dataset.diffView).toBe("changes");
    expect(toggle.querySelector(".lucide-fold-vertical")).not.toBeNull();

    await user.click(toggle);
    expect(
      screen.getByRole("button", {
        name: "현재 전체+변경 강조 · 클릭하면 닫기",
      }),
    ).toBe(toggle);
    expect(container.querySelector(".document-diff-view")).not.toBeNull();
    expect(toggle.dataset.diffView).toBe("full");
    expect(toggle.querySelector(".lucide-unfold-vertical")).not.toBeNull();

    await user.click(toggle);
    expect(
      screen.getByRole("button", { name: "마지막 commit 이후 변경 보기" }),
    ).toBe(toggle);
    expect(container.querySelector(".document-diff-view")).toBeNull();
    expect(toggle.querySelector(".lucide-file-diff")).not.toBeNull();
  });

  it("baseline이 unavailable이면 diff 토글을 숨긴다", async () => {
    testState.settings.activeSpace = "docs";
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    testState.workspace.activeDocument = {
      ...activeDocument,
      mode: "view",
      root: "/docs",
    };
    testState.workspace.openDocuments = [testState.workspace.activeDocument];

    render(<App />);

    await screen.findByRole("button", {
      name: "현재 View · 클릭하면 Edit | View 분할",
    });
    await waitFor(() =>
      expect(native.readDocumentBaseline).toHaveBeenCalledWith(
        "/docs",
        expect.any(String),
      ),
    );
    expect(
      screen.queryByRole("button", { name: "마지막 commit 이후 변경 보기" }),
    ).toBeNull();
  });

  it("문서를 전환하면 diff surface가 닫히고 새 문서의 baseline을 다시 조회한다", async () => {
    const user = userEvent.setup();
    native.readDocumentBaseline.mockResolvedValueOnce({
      content:
        "---\ncreated: 2026-08-01T00:00:00.000Z\nupdated: 2026-08-01T00:00:00.000Z\n---\n\nold body A\n",
      status: "baseline",
    });
    testState.settings.activeSpace = "docs";
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    const docA = {
      ...activeDocument,
      body: "new body A",
      mode: "view" as const,
      path: "a.md",
      root: "/docs",
    };
    testState.workspace.activeDocument = docA;
    testState.workspace.openDocuments = [docA];

    const { container, rerender } = render(<App />);

    const toggle = await screen.findByRole("button", {
      name: "마지막 commit 이후 변경 보기",
    });
    await user.click(toggle);
    expect(container.querySelector(".document-diff-view")).not.toBeNull();

    native.readDocumentBaseline.mockResolvedValueOnce({
      content:
        "---\ncreated: 2026-08-01T00:00:00.000Z\nupdated: 2026-08-01T00:00:00.000Z\n---\n\nold body B\n",
      status: "baseline",
    });
    const docB = { ...docA, body: "new body B", path: "b.md" };
    testState.workspace.activeDocument = docB;
    testState.workspace.openDocuments = [docB];
    rerender(<App />);

    // The reset lives in an effect (it must run after commit, since it kicks
    // off the new fetch), so this assertion only proves the eventual state is
    // correct, not that no in-between commit ever paired the old baseline
    // with the new document. The path guard on diffBaseline is what makes
    // that pairing structurally impossible regardless of timing.
    expect(container.querySelector(".document-diff-view")).toBeNull();
    await waitFor(() =>
      expect(native.readDocumentBaseline).toHaveBeenLastCalledWith(
        "/docs",
        "b.md",
      ),
    );
    await screen.findByRole("button", {
      name: "마지막 commit 이후 변경 보기",
    });
  });

  it("Human space에서는 baseline을 조회하지 않고 diff 토글도 없다", async () => {
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    testState.workspace.activeDocument = { ...activeDocument, mode: "view" };
    testState.workspace.openDocuments = [testState.workspace.activeDocument];

    render(<App />);

    await screen.findByRole("button", {
      name: "현재 View · 클릭하면 Edit | View 분할",
    });
    expect(native.readDocumentBaseline).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "마지막 commit 이후 변경 보기" }),
    ).toBeNull();
  });

  it("marks lowercase-expanding matches at their original Markdown offsets", async () => {
    const user = userEvent.setup();
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    testState.workspace.activeDocument = {
      ...activeDocument,
      body: "**İX** X",
      mode: "view",
    };
    testState.workspace.openDocuments = [testState.workspace.activeDocument];
    const { container } = render(<App />);
    await screen.findByText("İX");

    await user.keyboard("{Meta>}f{/Meta}");
    fireEvent.change(
      await screen.findByRole("searchbox", { name: "현재 문서 검색" }),
      { target: { value: "x" } },
    );

    expect(screen.getByRole("status").textContent).toBe("1/2");
    expect(
      [...container.querySelectorAll("mark.document-find-match")].map(
        (match) => match.textContent,
      ),
    ).toEqual(["X", "X"]);
  });

  it("maps escaped punctuation matches into rendered View text", async () => {
    const user = userEvent.setup();
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    testState.workspace.activeDocument = {
      ...activeDocument,
      body: "Escaped \\* marker",
      mode: "view",
    };
    testState.workspace.openDocuments = [testState.workspace.activeDocument];
    const { container } = render(<App />);
    await screen.findByText("Escaped * marker");

    await user.keyboard("{Meta>}f{/Meta}");
    fireEvent.change(
      await screen.findByRole("searchbox", { name: "현재 문서 검색" }),
      { target: { value: "*" } },
    );

    expect(screen.getByRole("status").textContent).toBe("1/1");
    expect(
      container.querySelector("mark.document-find-match")?.textContent,
    ).toBe("*");
  });

  it("maps decoded entity offsets in Split while preserving editor offsets", async () => {
    const user = userEvent.setup();
    const activeDocument = testState.workspace.activeDocument;
    if (!activeDocument) throw new TypeError("Active document is required");
    const body = "Fish &amp; chips";
    testState.workspace.activeDocument = {
      ...activeDocument,
      body,
      mode: "split",
    };
    testState.workspace.openDocuments = [testState.workspace.activeDocument];
    const { container } = render(<App />);
    await screen.findByText("Fish & chips");

    await user.keyboard("{Meta>}f{/Meta}");
    fireEvent.change(
      await screen.findByRole("searchbox", { name: "현재 문서 검색" }),
      { target: { value: "chips" } },
    );

    expect(
      container.querySelector("mark.document-find-match")?.textContent,
    ).toBe("chips");
    const editor = EditorView.findFromDOM(
      await screen.findByLabelText("Markdown 본문"),
    );
    const rawFrom = body.indexOf("chips");
    await waitFor(() =>
      expect(editor?.state.selection.main.from).toBe(rawFrom),
    );
    expect(editor?.state.selection.main.to).toBe(rawFrom + "chips".length);
    expect(editor?.state.sliceDoc(rawFrom, rawFrom + "chips".length)).toBe(
      "chips",
    );
  });
});

describe("pane navigation contract", () => {
  it("collapses the folder pane below 900px without persisting the responsive state", async () => {
    mediaState.matchesByQuery.set("(max-width: 900px)", true);

    const { container } = render(<App />);

    await screen.findByRole("radio", { name: "Human" });
    await waitFor(() =>
      expect(container.querySelector(".folder-pane")).toBeNull(),
    );
    expect(container.querySelector(".list-pane .space-header")).not.toBeNull();
    expect(saveSettings).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows one switcher without a root row in two-pane mode and switches after saving", async () => {
    // Given: the document list is visible while the folder pane is collapsed.
    testState.settings.folderPaneOpen = false;
    testState.settings.listPaneOpen = true;
    const calls: string[] = [];
    vi.mocked(testState.workspace.persistAllOpenDocuments).mockImplementation(
      async () => {
        calls.push("persist");
        return true;
      },
    );
    vi.mocked(saveSettings).mockImplementation(async () => {
      calls.push("settings");
    });
    const user = userEvent.setup();
    const { container } = render(<App />);

    // When: the user switches from Human to AI.
    const switcher = await screen.findByRole("radiogroup", {
      name: "공간 선택",
    });
    await user.click(screen.getByRole("radio", { name: /AI/ }));

    // Then: the fallback stays navigation-only and saves before switching.
    expect(
      screen.getAllByRole("radiogroup", { name: "공간 선택" }),
    ).toHaveLength(1);
    expect(switcher.closest(".list-pane")).not.toBeNull();
    expect(container.querySelector(".list-pane .root-row")).toBeNull();
    expect(screen.queryByText("⌘1")).toBeNull();
    await waitFor(() => expect(calls).toEqual(["persist", "settings"]));
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ activeSpace: "docs" }),
    );
  });

  it("keeps the current space when saving fails in two-pane mode", async () => {
    // Given: the document list is visible and open documents cannot be saved.
    testState.settings.folderPaneOpen = false;
    testState.settings.listPaneOpen = true;
    vi.mocked(testState.workspace.persistAllOpenDocuments).mockResolvedValue(
      false,
    );
    const user = userEvent.setup();
    render(<App />);

    // When: the user requests the AI space.
    await user.click(
      await screen.findByRole("radio", {
        name: /AI/,
      }),
    );

    // Then: the save barrier blocks the settings transition.
    await waitFor(() =>
      expect(
        testState.workspace.persistAllOpenDocuments,
      ).toHaveBeenCalledOnce(),
    );
    expect(saveSettings).not.toHaveBeenCalled();
    expect(
      screen.getByRole<HTMLInputElement>("radio", { name: /Human/ }).checked,
    ).toBe(true);
  });

  it("keeps one switcher and the root row in three-pane mode", async () => {
    // Given: both navigation panes are visible.
    testState.settings.folderPaneOpen = true;
    testState.settings.listPaneOpen = true;
    const { container } = render(<App />);

    // When: the workspace finishes rendering.
    await screen.findByRole("radiogroup", { name: "공간 선택" });

    // Then: the folder pane owns the sole switcher and active root row.
    expect(
      screen.getAllByRole("radiogroup", { name: "공간 선택" }),
    ).toHaveLength(1);
    expect(
      screen.getByRole("button", {
        name: "현재 Markdown 위치: /intent. 클릭하여 폴더 변경",
      }),
    ).toBe(container.querySelector(".folder-pane .root-row"));
  });

  it("hides switcher and root controls in content-only mode", async () => {
    // Given: both navigation panes are collapsed.
    testState.settings.folderPaneOpen = false;
    testState.settings.listPaneOpen = false;
    const { container } = render(<App />);

    // When: the content-only workspace finishes rendering.
    await screen.findByRole("button", {
      name: "현재 content-only · 클릭하면 3-pane 열기",
    });

    // Then: navigation controls are not repeated in the content pane.
    expect(
      screen.queryAllByRole("radiogroup", { name: "공간 선택" }),
    ).toHaveLength(0);
    expect(container.querySelector(".root-row")).toBeNull();
  });
});

describe("space-specific creation language", () => {
  it("keeps Human creation but presents AI as Open Folder", async () => {
    const user = userEvent.setup();
    vi.mocked(testState.workspace.persistAllOpenDocuments).mockResolvedValue(
      true,
    );

    render(<App />);

    expect(
      await screen.findAllByRole("button", { name: "새로운 의도" }),
    ).toHaveLength(2);
    expect(screen.getByRole("button", { name: "새 폴더" })).toBeDefined();

    await user.click(screen.getAllByRole("button", { name: "새로운 의도" })[0]);
    expect(screen.getByRole("dialog", { name: "새로운 의도" })).toBeDefined();
    expect(screen.getByLabelText("의도 이름")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "취소" }));

    await user.click(screen.getByRole("radio", { name: /AI/ }));

    expect(
      (await screen.findAllByRole("button", { name: "AI 폴더 열기" })).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "새 모음" })).toBeNull();
    expect(screen.queryByRole("button", { name: "새 문서" })).toBeNull();
  });
});

describe("settings navigation", () => {
  it("opens Settings from the folder pane in three-pane mode", async () => {
    // Given: the complete navigation layout is visible.
    testState.settings.folderPaneOpen = true;
    testState.settings.listPaneOpen = true;
    const user = userEvent.setup();
    const { container } = render(<App />);

    // When: the visible Settings button is activated.
    const button = await screen.findByRole("button", { name: "설정" });
    await user.click(button);

    // Then: the folder pane owns the entry and the old theme select is gone.
    expect(button.closest(".folder-pane")).not.toBeNull();
    expect(container.querySelectorAll(".settings-button")).toHaveLength(1);
    expect(screen.queryByRole("combobox", { name: "테마" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "설정" })).toBeDefined();
  });

  it("places Settings in the document list when folders are collapsed", async () => {
    // Given: the app is in two-pane mode.
    testState.settings.folderPaneOpen = false;
    testState.settings.listPaneOpen = true;
    const { container } = render(<App />);

    // When: navigation finishes rendering.
    const button = await screen.findByRole("button", { name: "설정" });

    // Then: the list pane owns the only Settings entry.
    expect(button.closest(".list-pane")).not.toBeNull();
    expect(container.querySelectorAll(".settings-button")).toHaveLength(1);
  });

  it("hides Settings in content-only mode", async () => {
    // Given: both navigation panes are collapsed.
    testState.settings.folderPaneOpen = false;
    testState.settings.listPaneOpen = false;
    render(<App />);

    // When: the content-only workspace is visible.
    await screen.findByRole("button", {
      name: "현재 content-only · 클릭하면 3-pane 열기",
    });

    // Then: no Settings entry is repeated in the content pane.
    expect(screen.queryByRole("button", { name: "설정" })).toBeNull();
  });

  it("applies the selected theme immediately and restores opener focus", async () => {
    // Given: Settings is opened from the visible navigation button.
    const user = userEvent.setup();
    render(<App />);
    const opener = await screen.findByRole("button", { name: "설정" });
    await user.click(opener);

    // When: 투톤 is selected and the dialog is closed.
    await user.click(screen.getByRole("radio", { name: "투톤" }));
    await waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe("charcoal"),
    );
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "charcoal" }),
    );
    await user.click(screen.getByRole("button", { name: "닫기" }));

    // Then: keyboard focus returns to the Settings entry point.
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("uses English by default and applies Korean immediately", async () => {
    // Given: a clean English-language workspace.
    testState.settings.language = "en";
    const user = userEvent.setup();
    render(<App />);
    const opener = await screen.findByRole("button", { name: "Settings" });
    await user.click(opener);

    // When: Korean is selected from the dedicated Language section.
    await user.click(screen.getByRole("button", { name: "Language" }));
    await user.click(screen.getByRole("radio", { name: "한국어" }));

    // Then: persistence and the rendered application language change together.
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ language: "ko" }),
    );
    await waitFor(() => {
      expect(document.documentElement.lang).toBe("ko");
      expect(screen.getByRole("dialog", { name: "설정" })).toBeDefined();
    });
  });

  it("applies and persists the selected writing font immediately", async () => {
    // Given: a clean workspace using the default Sans-serif writing font.
    testState.settings.language = "en";
    testState.settings.writingFont = "sans";
    const user = userEvent.setup();
    render(<App />);
    const opener = await screen.findByRole("button", { name: "Settings" });
    expect(document.documentElement.dataset.writingFont).toBe("sans");
    await user.click(opener);

    // When: Serif is selected from Typography.
    await user.click(screen.getByRole("button", { name: "Typography" }));
    await user.click(screen.getByRole("radio", { name: "Serif" }));

    // Then: writing surfaces update and the selection is persisted together.
    await waitFor(() =>
      expect(document.documentElement.dataset.writingFont).toBe("serif"),
    );
    expect(saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ writingFont: "serif" }),
    );
  });

  it("serializes tab-session and typography writes from the latest settings", async () => {
    // Given: a session update and a font change can start from the same render.
    testState.settings.language = "en";
    let resolveFirstWrite: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => {
      resolveFirstWrite = resolve;
    });
    vi.mocked(saveSettings)
      .mockImplementationOnce(() => firstWrite)
      .mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Typography" }));
    const onSessionChange = testState.sessionChanges.at(-1);
    if (!onSessionChange) throw new TypeError("Session callback is required");
    const session = {
      paths: ["draft.md"],
      activePath: "draft.md",
    } satisfies TabSession;
    const sessionSnapshot = {
      ...testState.settings,
      tabSessions: { ...testState.settings.tabSessions, intent: session },
    };
    const typographySnapshot = {
      ...sessionSnapshot,
      writingFont: "serif",
    };

    // When: both changes are emitted before React commits another render.
    act(() => {
      onSessionChange(session);
      screen.getByRole("radio", { name: "Serif" }).click();
    });

    // Then: the second complete snapshot waits and retains the first change.
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(1));
    expect(saveSettings).toHaveBeenNthCalledWith(1, sessionSnapshot);
    if (!resolveFirstWrite) throw new TypeError("Write resolver is required");
    resolveFirstWrite();
    await waitFor(() => expect(saveSettings).toHaveBeenCalledTimes(2));
    expect(saveSettings).toHaveBeenNthCalledWith(2, typographySnapshot);
  });
});

describe("folder Trash persistence barrier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dialog.confirm.mockResolvedValue(true);
  });

  it("persists open documents before trashing an approved folder", async () => {
    const calls: string[] = [];
    vi.mocked(testState.workspace.persistAllOpenDocuments).mockImplementation(
      async () => {
        calls.push("persist");
        return true;
      },
    );
    vi.mocked(testState.workspace.removeFolderAt).mockImplementation(
      async () => {
        calls.push("remove");
      },
    );
    const user = userEvent.setup();
    render(<App />);
    const currentFolder = await screen.findByRole("button", {
      name: "current",
    });

    fireEvent.contextMenu(currentFolder);
    await user.click(screen.getByRole("menuitem", { name: "휴지통으로 이동" }));

    await waitFor(() => expect(calls).toEqual(["persist", "remove"]));
    expect(testState.workspace.removeFolderAt).toHaveBeenCalledWith(
      "projects/current",
    );
    expect(document.activeElement).toBe(currentFolder);
  });

  it("keeps the folder when persisting an open document fails", async () => {
    vi.mocked(testState.workspace.persistAllOpenDocuments).mockResolvedValue(
      false,
    );
    const user = userEvent.setup();
    render(<App />);
    const currentFolder = await screen.findByRole("button", {
      name: "current",
    });

    fireEvent.contextMenu(currentFolder);
    await user.click(screen.getByRole("menuitem", { name: "휴지통으로 이동" }));

    await waitFor(() =>
      expect(
        testState.workspace.persistAllOpenDocuments,
      ).toHaveBeenCalledOnce(),
    );
    expect(testState.workspace.removeFolderAt).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(currentFolder);
  });
});
