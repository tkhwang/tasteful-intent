// @vitest-environment jsdom

import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { Suspense, startTransition, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const native = vi.hoisted(() => {
  class NativeCommandError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }

  return {
    NativeCommandError,
    createDocument: vi.fn(),
    createFolder: vi.fn(),
    moveEntry: vi.fn(),
    readDocument: vi.fn(),
    readDocumentSnippets: vi.fn(),
    renameDocument: vi.fn(),
    renameFolder: vi.fn(),
    saveDocument: vi.fn(),
    scanLibrary: vi.fn(),
    trashEntry: vi.fn(),
  };
});

vi.mock("@/lib/native", () => native);

import windowCapabilities from "../../src-tauri/capabilities/default.json";
import { runCloseBarrier, useLibraryWorkspace } from "./useLibraryWorkspace";

const content = (body: string) =>
  `---\ncreated: 2026-08-05T00:00:00.000Z\nupdated: 2026-08-05T00:00:00.000Z\n---\n${body}`;

const documents = [
  { path: "a.md", parent: "", title: "a", updatedMs: 1 },
  { path: "b.md", parent: "", title: "b", updatedMs: 1 },
  { path: "folder/c.md", parent: "folder", title: "c", updatedMs: 1 },
];

describe("useLibraryWorkspace tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.scanLibrary.mockResolvedValue({
      folders: [{ path: "folder", parent: "", name: "folder" }],
      documents,
    });
    native.readDocument.mockImplementation((_root: string, path: string) =>
      Promise.resolve({ path, content: content(path), mtimeMs: 1 }),
    );
    native.readDocumentSnippets.mockImplementation(
      (_root: string, paths: readonly string[]) =>
        Promise.resolve(paths.map((path) => ({ path, snippet: path }))),
    );
    native.saveDocument.mockImplementation(
      (_root: string, path: string, markdown: string) =>
        Promise.resolve({ path, content: markdown, mtimeMs: 2 }),
    );
    native.renameFolder.mockResolvedValue({ path: "renamed" });
  });

  it("keeps body, mode, and background save state independent per tab", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.openDocument("a.md");
      await result.current.openDocument("b.md");
      await result.current.openDocument("folder/c.md");
    });
    act(() => {
      result.current.setActiveDocument("a.md");
      result.current.updateBody("changed A");
      result.current.setMode("view");
      result.current.setActiveDocument("b.md");
    });

    await waitFor(() =>
      expect(native.saveDocument).toHaveBeenCalledWith(
        "/root",
        "a.md",
        expect.stringContaining("changed A"),
        1,
      ),
    );
    expect(result.current.openDocuments.map((entry) => entry.path)).toEqual([
      "a.md",
      "b.md",
      "folder/c.md",
    ]);
    await waitFor(() =>
      expect(
        result.current.openDocuments.find((entry) => entry.path === "a.md"),
      ).toMatchObject({ body: "changed A", mode: "view", saveStatus: "saved" }),
    );
    expect(result.current.activeDocument).toMatchObject({
      path: "b.md",
      mode: "edit",
    });
  });

  it("reloads the active document from disk without changing its identity or mode", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("a.md");
    });
    act(() => result.current.setMode("view"));
    native.readDocument.mockResolvedValueOnce({
      path: "a.md",
      content: content("external update"),
      mtimeMs: 8,
    });
    native.scanLibrary.mockResolvedValueOnce({
      folders: [{ path: "folder", parent: "", name: "folder" }],
      documents: [
        { ...documents[0], updatedMs: 8 },
        documents[1],
        documents[2],
      ],
    });

    await act(async () => {
      await expect(result.current.reloadCurrentDocument()).resolves.toBe(true);
    });

    expect(result.current.activePath).toBe("a.md");
    expect(result.current.activeDocument).toMatchObject({
      body: "external update",
      mode: "view",
      mtimeMs: 8,
    });
    expect(result.current.snapshot.documents[0].updatedMs).toBe(8);
  });

  it("refreshes the active row snippet after a same-mtime disk reload", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() =>
      expect(result.current.visibleSnippets.get("a.md")).toBe("a.md"),
    );
    await act(async () => {
      await result.current.openDocument("a.md");
    });
    native.readDocument.mockResolvedValueOnce({
      path: "a.md",
      content: content("external update"),
      mtimeMs: 1,
    });
    native.readDocumentSnippets.mockImplementation(
      (_root: string, paths: readonly string[]) =>
        Promise.resolve(
          paths.map((path) => ({ path, snippet: `fresh:${path}` })),
        ),
    );
    native.readDocumentSnippets.mockClear();

    await act(async () => {
      await expect(result.current.reloadCurrentDocument()).resolves.toBe(true);
    });

    await waitFor(() =>
      expect(native.readDocumentSnippets).toHaveBeenCalledWith("/root", [
        "a.md",
      ]),
    );
    expect(result.current.visibleSnippets.get("a.md")).toBe("fresh:a.md");
  });

  it("discards a pending reload after the active tab changes", async () => {
    // Given: a nested document reload is waiting on its disk read.
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("folder/c.md");
      await result.current.openDocument("b.md");
    });
    act(() => result.current.setActiveDocument("folder/c.md"));
    let resolveRead: (payload: {
      readonly path: string;
      readonly content: string;
      readonly mtimeMs: number;
    }) => void = () => undefined;
    const pendingRead = new Promise<{
      readonly path: string;
      readonly content: string;
      readonly mtimeMs: number;
    }>((resolve) => {
      resolveRead = resolve;
    });
    native.readDocument.mockReturnValueOnce(pendingRead);
    native.scanLibrary.mockResolvedValueOnce({
      folders: [{ path: "folder", parent: "", name: "folder" }],
      documents: [
        documents[0],
        documents[1],
        { ...documents[2], updatedMs: 8 },
      ],
    });

    // When: the user switches tabs before the reload read completes.
    let reload: Promise<boolean> | undefined;
    act(() => {
      reload = result.current.reloadCurrentDocument();
    });
    await waitFor(() =>
      expect(native.readDocument).toHaveBeenCalledWith("/root", "folder/c.md"),
    );
    act(() => result.current.setActiveDocument("b.md"));
    resolveRead({
      path: "folder/c.md",
      content: content("stale reload"),
      mtimeMs: 8,
    });

    // Then: the stale completion changes no workspace projection.
    await act(async () => {
      if (!reload) throw new TypeError("Reload promise is required");
      await expect(reload).resolves.toBe(false);
    });
    expect(result.current.activePath).toBe("b.md");
    expect(result.current.selectedFolder).toBe("");
    expect(
      result.current.openDocuments.find(
        (document) => document.path === "folder/c.md",
      )?.body,
    ).toBe("folder/c.md");
    expect(
      result.current.snapshot.documents.find(
        (document) => document.path === "folder/c.md",
      )?.updatedMs,
    ).toBe(1);
  });

  it("saves a dirty active document before reloading it from disk", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("a.md");
    });
    act(() => result.current.updateBody("local update"));
    native.readDocument.mockResolvedValueOnce({
      path: "a.md",
      content: content("saved disk update"),
      mtimeMs: 2,
    });
    native.saveDocument.mockClear();
    native.readDocument.mockClear();

    await act(async () => {
      await expect(result.current.reloadCurrentDocument()).resolves.toBe(true);
    });

    expect(native.saveDocument).toHaveBeenCalledWith(
      "/root",
      "a.md",
      expect.stringContaining("local update"),
      1,
    );
    expect(native.readDocument).toHaveBeenCalledWith("/root", "a.md");
    expect(native.saveDocument.mock.invocationCallOrder[0]).toBeLessThan(
      native.readDocument.mock.invocationCallOrder[0],
    );
    expect(result.current.activeDocument?.body).toBe("saved disk update");
  });

  it("keeps the dirty buffer when saving before reload fails", async () => {
    native.saveDocument.mockRejectedValueOnce(new Error("conflict"));
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("a.md");
    });
    act(() => result.current.updateBody("unsaved local update"));
    native.readDocument.mockClear();

    await act(async () => {
      await expect(result.current.reloadCurrentDocument()).resolves.toBe(false);
    });

    expect(native.readDocument).not.toHaveBeenCalled();
    expect(result.current.activeDocument).toMatchObject({
      body: "unsaved local update",
      saveStatus: "error",
    });
  });

  it("keeps the current buffer when the reload read fails", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("a.md");
    });
    native.readDocument.mockRejectedValueOnce(new Error("unavailable"));

    await act(async () => {
      await expect(result.current.reloadCurrentDocument()).resolves.toBe(false);
    });

    expect(result.current.activeDocument).toMatchObject({
      body: "a.md",
      path: "a.md",
    });
    expect(result.current.errorMessage).toBe("unavailable");
  });

  it("blocks an aggregate transition when one dirty tab fails without dropping buffers", async () => {
    native.saveDocument.mockImplementation(
      (_root: string, path: string, markdown: string) =>
        path === "b.md"
          ? Promise.reject(new Error("conflict"))
          : Promise.resolve({ path, content: markdown, mtimeMs: 2 }),
    );
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("a.md");
      await result.current.openDocument("b.md");
    });
    act(() => {
      result.current.setActiveDocument("a.md");
      result.current.updateBody("buffer A");
      result.current.setActiveDocument("b.md");
      result.current.updateBody("buffer B");
    });

    await act(async () => {
      await expect(result.current.persistAllOpenDocuments()).resolves.toBe(
        false,
      );
    });

    expect(result.current.openDocuments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "a.md", body: "buffer A" }),
        expect.objectContaining({
          path: "b.md",
          body: "buffer B",
          saveStatus: "error",
        }),
      ]),
    );
  });

  it("rebases open tab paths for folder rename and filters missing restore paths", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", {
        defaultMode: "view",
        initialSession: {
          paths: ["missing.md", "folder/c.md", "a.md"],
          activePath: "folder/c.md",
        },
      }),
    );
    await waitFor(() =>
      expect(result.current.openDocuments.map((entry) => entry.path)).toEqual([
        "folder/c.md",
        "a.md",
      ]),
    );
    expect(result.current.activeDocument?.path).toBe("folder/c.md");

    await act(async () => {
      await result.current.renameFolderAt("folder", "renamed");
    });

    expect(result.current.openDocuments.map((entry) => entry.path)).toEqual([
      "renamed/c.md",
      "a.md",
    ]);
    expect(result.current.activeDocument?.path).toBe("renamed/c.md");
  });

  it("replaces root-local documents when the AI folder changes", async () => {
    const { result, rerender } = renderHook(
      ({ root }) => useLibraryWorkspace(root, { defaultMode: "view" }),
      { initialProps: { root: "/docs/a" } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.openDocument("shared.md");
    });
    expect(result.current.openDocuments).toEqual([
      expect.objectContaining({ root: "/docs/a", path: "shared.md" }),
    ]);

    rerender({ root: "/docs/b" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("shared.md");
    });

    expect(result.current.openDocuments).toEqual([
      expect.objectContaining({ root: "/docs/b", path: "shared.md" }),
    ]);
    expect(result.current.activePath).toBe("shared.md");
  });

  it("uses an injected scanner and restores the requested selected folder", async () => {
    // Given: a Pinned workspace with its own scanner and navigation state.
    const scan = vi.fn().mockResolvedValue({
      folders: [{ path: "docs", parent: "", name: "docs" }],
      documents: [
        { path: "docs/a.md", parent: "docs", title: "a", updatedMs: 1 },
      ],
    });
    const onSelectedFolderChange = vi.fn();

    // When: the workspace restores through the injected boundary.
    const { result } = renderHook(() =>
      useLibraryWorkspace("/work/a", {
        defaultMode: "view",
        initialSelectedFolder: "docs",
        onSelectedFolderChange,
        scan,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Then: the native Human scanner is untouched.
    expect(scan).toHaveBeenCalledWith("/work/a");
    expect(native.scanLibrary).not.toHaveBeenCalled();
    expect(result.current.selectedFolder).toBe("docs");
    expect(onSelectedFolderChange).toHaveBeenCalledWith("docs");
  });

  it("preserves a Pinned session when its root is unavailable and restores it after refresh", async () => {
    // Given: a persisted Pinned tab whose root is temporarily missing.
    const scan = vi
      .fn()
      .mockRejectedValueOnce(
        new native.NativeCommandError(
          "invalid-root",
          "Could not inspect library root",
        ),
      )
      .mockResolvedValue({ folders: [], documents: [documents[0]] });
    const onSessionChange = vi.fn();
    const { result } = renderHook(() =>
      useLibraryWorkspace("/work/a", {
        defaultMode: "view",
        initialSession: { paths: ["a.md"], activePath: "a.md" },
        onSessionChange,
        scan,
      }),
    );

    // When: the initial scan fails at the native root boundary.
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Then: no empty replacement session is emitted.
    expect(result.current.rootUnavailable).toBe(true);
    expect(onSessionChange).not.toHaveBeenCalled();

    // When: the same canonical path becomes available and refresh succeeds.
    await act(async () => {
      await result.current.refresh();
    });

    // Then: the original references restore before a surviving session emits.
    await waitFor(() =>
      expect(result.current.openDocuments.map(({ path }) => path)).toEqual([
        "a.md",
      ]),
    );
    expect(result.current.rootUnavailable).toBe(false);
    expect(onSessionChange).toHaveBeenLastCalledWith({
      paths: ["a.md"],
      activePath: "a.md",
    });
  });
});

describe("useLibraryWorkspace snippets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.createFolder.mockResolvedValue({ path: "new" });
    native.scanLibrary.mockResolvedValue({
      folders: [{ path: "folder", parent: "", name: "folder" }],
      documents,
    });
    native.readDocument.mockImplementation((_root: string, path: string) =>
      Promise.resolve({ path, content: content(path), mtimeMs: 1 }),
    );
    native.readDocumentSnippets.mockImplementation(
      (_root: string, paths: readonly string[]) =>
        Promise.resolve(
          paths.map((path) => ({ path, snippet: `snippet:${path}` })),
        ),
    );
    native.saveDocument.mockImplementation(
      (_root: string, path: string, markdown: string) =>
        Promise.resolve({ path, content: markdown, mtimeMs: 5 }),
    );
  });

  it("loads only documents visible in the selected folder as one batch", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );

    await waitFor(() =>
      expect(native.readDocumentSnippets).toHaveBeenCalledWith("/root", [
        "a.md",
        "b.md",
      ]),
    );
    expect([...result.current.visibleSnippets]).toEqual([
      ["a.md", "snippet:a.md"],
      ["b.md", "snippet:b.md"],
    ]);
  });

  it("validates snippet responses against the committed scope during a suspended transition", async () => {
    // Given: the committed root scope has an in-flight snippet request.
    let resolveSnippets: (
      results: readonly {
        readonly path: string;
        readonly snippet: string | null;
      }[],
    ) => void = () => undefined;
    const snippets = new Promise<
      readonly {
        readonly path: string;
        readonly snippet: string | null;
      }[]
    >((resolve) => {
      resolveSnippets = resolve;
    });
    native.readDocumentSnippets.mockReturnValueOnce(snippets);
    const suspended = new Promise<never>(() => undefined);
    const pendingRender = vi.fn();
    function Harness() {
      const workspace = useLibraryWorkspace("/root", { defaultMode: "edit" });
      const [shouldSuspend, setShouldSuspend] = useState(false);
      if (shouldSuspend) {
        pendingRender();
        throw suspended;
      }
      return (
        <>
          <button
            type="button"
            onClick={() => {
              startTransition(() => {
                workspace.setSelectedFolder("folder");
                setShouldSuspend(true);
              });
            }}
          >
            Switch folder
          </button>
          <output data-testid="snippet">
            {workspace.visibleSnippets.get("a.md") ?? ""}
          </output>
        </>
      );
    }
    render(
      <Suspense fallback={null}>
        <Harness />
      </Suspense>,
    );
    await waitFor(() =>
      expect(native.readDocumentSnippets).toHaveBeenCalledWith("/root", [
        "a.md",
        "b.md",
      ]),
    );

    // When: a folder change renders but cannot commit, then the root response arrives.
    fireEvent.click(screen.getByRole("button", { name: "Switch folder" }));
    await waitFor(() => expect(pendingRender).toHaveBeenCalled());
    await act(async () => {
      resolveSnippets([
        { path: "a.md", snippet: "snippet:a.md" },
        { path: "b.md", snippet: "snippet:b.md" },
      ]);
      await snippets;
    });

    // Then: validation still accepts the response for the last committed scope.
    await waitFor(() =>
      expect(screen.getByTestId("snippet").textContent).toBe("snippet:a.md"),
    );
  });

  it("reuses matching cache entries and reloads only a changed mtime", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(native.readDocumentSnippets).toHaveBeenCalled());

    act(() => result.current.setSelectedFolder("folder"));
    await waitFor(() =>
      expect(native.readDocumentSnippets).toHaveBeenCalledWith("/root", [
        "folder/c.md",
      ]),
    );
    act(() => result.current.setSelectedFolder(""));
    await waitFor(() =>
      expect(result.current.visibleDocuments).toHaveLength(2),
    );
    expect(
      native.readDocumentSnippets.mock.calls.filter(
        ([, paths]) => paths.length === 2,
      ),
    ).toHaveLength(1);

    native.scanLibrary.mockResolvedValue({
      folders: [{ path: "folder", parent: "", name: "folder" }],
      documents: [
        { ...documents[0], updatedMs: 2 },
        documents[1],
        documents[2],
      ],
    });
    await act(async () => {
      await result.current.addFolder("new");
    });
    await waitFor(() =>
      expect(native.readDocumentSnippets).toHaveBeenCalledWith("/root", [
        "a.md",
      ]),
    );
  });

  it("refreshes a saved row snippet and reorders its updated time", async () => {
    native.scanLibrary.mockResolvedValue({
      folders: [{ path: "folder", parent: "", name: "folder" }],
      documents: [
        { ...documents[1], updatedMs: 4 },
        documents[0],
        documents[2],
      ],
    });
    native.readDocumentSnippets.mockImplementation(
      (_root: string, paths: readonly string[]) =>
        Promise.resolve(
          paths.map((path) => ({
            path,
            snippet: paths.length === 1 ? "fresh A" : `old:${path}`,
          })),
        ),
    );
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("a.md");
    });
    act(() => result.current.updateBody("fresh A"));

    await act(async () => {
      await result.current.persistCurrent();
    });

    expect(result.current.visibleDocuments.map((entry) => entry.path)).toEqual([
      "a.md",
      "b.md",
    ]);
    expect(result.current.visibleDocuments[0].updatedMs).toBe(5);
    expect(result.current.visibleSnippets.get("a.md")).toBe("fresh A");
  });

  it("deduplicates the save refresh from the visible-document effect", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("a.md");
    });
    act(() => result.current.updateBody("changed"));
    await act(async () => {
      await result.current.persistCurrent();
    });

    expect(
      native.readDocumentSnippets.mock.calls.filter(
        ([, paths]) => paths.length === 1 && paths[0] === "a.md",
      ),
    ).toHaveLength(1);
  });

  it("keeps navigation available when snippets are null or a batch fails", async () => {
    native.readDocumentSnippets
      .mockResolvedValueOnce([
        { path: "a.md", snippet: null },
        { path: "b.md", snippet: "cached B" },
      ])
      .mockRejectedValueOnce(new Error("temporary read failure"));
    const { result } = renderHook(() =>
      useLibraryWorkspace("/root", { defaultMode: "edit" }),
    );
    await waitFor(() =>
      expect(result.current.visibleSnippets.get("b.md")).toBe("cached B"),
    );
    expect(result.current.visibleSnippets.has("a.md")).toBe(false);

    act(() => result.current.setSelectedFolder("folder"));
    await waitFor(() =>
      expect(native.readDocumentSnippets).toHaveBeenCalledTimes(2),
    );
    await act(async () => {
      await expect(result.current.openDocument("folder/c.md")).resolves.toBe(
        true,
      );
    });
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.visibleSnippets.size).toBe(0);
  });
});

describe("window close barrier", () => {
  it("grants the force-close command used after the save barrier", () => {
    expect(windowCapabilities.permissions).toContain(
      "core:window:allow-destroy",
    );
  });

  it("destroys the window only after every open document is saved", async () => {
    const destroy = vi.fn().mockResolvedValue(undefined);

    await expect(
      runCloseBarrier(() => Promise.resolve(false), destroy),
    ).resolves.toBe(false);
    expect(destroy).not.toHaveBeenCalled();

    await expect(
      runCloseBarrier(() => Promise.resolve(true), destroy),
    ).resolves.toBe(true);
    expect(destroy).toHaveBeenCalledOnce();
  });
});
