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

const native = vi.hoisted(() => ({
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
}));

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

    expect(result.current.activeIdentity).toBe("a.md");
    expect(result.current.activeDocument).toMatchObject({
      body: "external update",
      mode: "view",
      mtimeMs: 8,
    });
    expect(result.current.snapshot.documents[0].updatedMs).toBe(8);
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

  it("keeps same-path documents and save identities independent across AI roots", async () => {
    const { result, rerender } = renderHook(
      ({ root }) =>
        useLibraryWorkspace(root, {
          defaultMode: "view",
          globalDocuments: true,
        }),
      { initialProps: { root: "/docs/a" } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.openDocument("shared.md");
    });
    rerender({ root: "/docs/b" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.openDocument("shared.md");
    });

    expect(
      result.current.openDocuments.map(({ root, path }) => ({ root, path })),
    ).toEqual([
      { root: "/docs/a", path: "shared.md" },
      { root: "/docs/b", path: "shared.md" },
    ]);

    act(() => result.current.updateBody("changed in B"));
    await act(async () => {
      await result.current.activateDocument({
        root: "/docs/a",
        path: "shared.md",
      });
    });

    expect(native.saveDocument).toHaveBeenCalledWith(
      "/docs/b",
      "shared.md",
      expect.stringContaining("changed in B"),
      1,
    );
    expect(result.current.activeReference).toEqual({
      root: "/docs/a",
      path: "shared.md",
    });
  });

  it("opens an external document reference and moves to its source path", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/docs/a", {
        defaultMode: "view",
        globalDocuments: true,
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.openDocumentReference({
          root: "/docs/b",
          path: "folder/b.md",
        }),
      ).resolves.toBe(true);
    });

    expect(native.scanLibrary).toHaveBeenCalledWith("/docs/b");
    expect(native.readDocument).toHaveBeenCalledWith("/docs/b", "folder/b.md");
    expect(result.current.activeReference).toEqual({
      root: "/docs/b",
      path: "folder/b.md",
    });
    expect(result.current.selectedFolder).toBe("folder");
  });

  it("scopes snippets and cache entries to an opened cross-root snapshot", async () => {
    native.scanLibrary.mockImplementation((root: string) =>
      Promise.resolve({
        folders: [],
        documents: [
          { path: "shared.md", parent: "", title: root, updatedMs: 1 },
        ],
      }),
    );
    native.readDocumentSnippets.mockImplementation(
      (root: string, paths: readonly string[]) =>
        Promise.resolve(
          paths.map((path) => ({ path, snippet: `${root}:${path}` })),
        ),
    );
    const { result } = renderHook(() =>
      useLibraryWorkspace("/docs/a", {
        defaultMode: "view",
        globalDocuments: true,
      }),
    );
    await waitFor(() =>
      expect(result.current.visibleSnippets.get("shared.md")).toBe(
        "/docs/a:shared.md",
      ),
    );

    await act(async () => {
      await result.current.openDocumentReference({
        root: "/docs/b",
        path: "shared.md",
      });
    });

    await waitFor(() =>
      expect(result.current.visibleSnippets.get("shared.md")).toBe(
        "/docs/b:shared.md",
      ),
    );
    expect(native.readDocumentSnippets).toHaveBeenCalledWith("/docs/b", [
      "shared.md",
    ]);
  });

  it("refreshes the root that owns an activated cross-root snapshot", async () => {
    native.scanLibrary.mockImplementation((root: string) =>
      Promise.resolve({
        folders: [],
        documents: [
          {
            path: root === "/docs/a" ? "a.md" : "b.md",
            parent: "",
            title: root,
            updatedMs: 1,
          },
        ],
      }),
    );
    const { result } = renderHook(() =>
      useLibraryWorkspace("/docs/a", {
        defaultMode: "view",
        globalDocuments: true,
        initialSession: {
          documents: [
            { root: "/docs/a", path: "a.md" },
            { root: "/docs/b", path: "b.md" },
          ],
          active: { root: "/docs/a", path: "a.md" },
        },
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.activateDocument({ root: "/docs/b", path: "b.md" });
    });
    native.scanLibrary.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(native.scanLibrary).toHaveBeenCalledWith("/docs/b");
  });

  it("keeps an initialized AI workspace mounted when settings catch up to its active root", async () => {
    const { result, rerender } = renderHook(
      ({ root }) =>
        useLibraryWorkspace(root, {
          defaultMode: "view",
          globalDocuments: true,
          initialSession: {
            documents: [
              { root: "/docs/a", path: "a.md" },
              { root: "/docs/b", path: "b.md" },
            ],
            active: { root: "/docs/a", path: "a.md" },
          },
        }),
      { initialProps: { root: "/docs/a" } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.activateDocument({ root: "/docs/b", path: "b.md" });
    });
    native.scanLibrary.mockClear();

    rerender({ root: "/docs/b" });

    expect(result.current.loading).toBe(false);
    expect(native.scanLibrary).not.toHaveBeenCalled();
  });

  it("restores the snapshot owned by the active cross-root document", async () => {
    native.scanLibrary.mockImplementation((root: string) =>
      Promise.resolve({
        folders: [],
        documents: [
          {
            path: root === "/docs/a" ? "a.md" : "b.md",
            parent: "",
            title: root,
            updatedMs: 1,
          },
        ],
      }),
    );
    const { result } = renderHook(() =>
      useLibraryWorkspace("/docs/a", {
        defaultMode: "view",
        globalDocuments: true,
        initialSession: {
          documents: [
            { root: "/docs/a", path: "a.md" },
            { root: "/docs/b", path: "b.md" },
          ],
          active: { root: "/docs/b", path: "b.md" },
        },
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.activeReference).toEqual({
      root: "/docs/b",
      path: "b.md",
    });
    expect(result.current.snapshot.documents.map(({ path }) => path)).toEqual([
      "b.md",
    ]);
    expect(native.scanLibrary).toHaveBeenCalledWith("/docs/b");
  });

  it("keeps the active AI tab unchanged when a target root scan fails", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/docs/a", {
        defaultMode: "view",
        globalDocuments: true,
        initialSession: {
          documents: [
            { root: "/docs/a", path: "a.md" },
            { root: "/docs/b", path: "b.md" },
          ],
          active: { root: "/docs/a", path: "a.md" },
        },
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    native.scanLibrary.mockImplementation((root: string) =>
      root === "/docs/b"
        ? Promise.reject(new Error("unavailable"))
        : Promise.resolve({ folders: [], documents }),
    );

    await act(async () => {
      await expect(
        result.current.activateDocument({ root: "/docs/b", path: "b.md" }),
      ).resolves.toBe(false);
    });

    expect(result.current.activeReference).toEqual({
      root: "/docs/a",
      path: "a.md",
    });
  });

  it("closes an active AI tab with a right-side cross-root fallback", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/docs/a", {
        defaultMode: "view",
        globalDocuments: true,
        initialSession: {
          documents: [
            { root: "/docs/a", path: "a.md" },
            { root: "/docs/b", path: "folder/b.md" },
          ],
          active: { root: "/docs/a", path: "a.md" },
        },
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.closeDocument("/docs/a\0a.md")).resolves.toBe(
        true,
      );
    });

    expect(native.scanLibrary).toHaveBeenCalledWith("/docs/b");
    expect(result.current.activeReference).toEqual({
      root: "/docs/b",
      path: "folder/b.md",
    });
    expect(result.current.selectedFolder).toBe("folder");
    native.scanLibrary.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(native.scanLibrary).toHaveBeenCalledWith("/docs/b");
  });

  it("keeps the active root snapshot when closing an inactive AI tab", async () => {
    const { result } = renderHook(() =>
      useLibraryWorkspace("/docs/a", {
        defaultMode: "view",
        globalDocuments: true,
        initialSession: {
          documents: [
            { root: "/docs/a", path: "a.md" },
            { root: "/docs/b", path: "b.md" },
            { root: "/docs/c", path: "folder/c.md" },
          ],
          active: { root: "/docs/a", path: "a.md" },
        },
      }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    native.scanLibrary.mockClear();

    await act(async () => {
      await expect(result.current.closeDocument("/docs/b\0b.md")).resolves.toBe(
        true,
      );
    });

    expect(native.scanLibrary).not.toHaveBeenCalled();
    expect(result.current.activeReference).toEqual({
      root: "/docs/a",
      path: "a.md",
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(native.scanLibrary).toHaveBeenCalledWith("/docs/a");
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
