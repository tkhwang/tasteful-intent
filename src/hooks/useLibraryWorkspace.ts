import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  parseMarkdown,
  serializeMarkdown,
  withUpdatedBody,
} from "@/lib/markdown";
import {
  createDocument,
  createFolder,
  moveEntry,
  readDocument,
  readDocumentSnippets,
  renameDocument,
  renameFolder,
  saveDocument,
  scanLibrary,
  trashEntry,
} from "@/lib/native";
import type {
  DocsDocumentRef,
  DocsTabSession,
  DocumentEntry,
  EditorMode,
  LibrarySnapshot,
  OpenDocument,
  TabSession,
} from "@/types/library";

const emptySnapshot: LibrarySnapshot = { folders: [], documents: [] };

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type WorkspaceDocument = OpenDocument & {
  readonly root: string;
  readonly mode: EditorMode;
  readonly saveStatus: SaveStatus;
};

type InternalDocument = WorkspaceDocument & {
  readonly dirty: boolean;
  readonly revision: number;
};

type SnippetCacheEntry = {
  readonly updatedMs: number;
  readonly snippet: string;
};

type WorkspaceOptions = {
  readonly defaultMode: EditorMode;
  readonly globalDocuments?: boolean;
  readonly initialSession?: TabSession | DocsTabSession;
  readonly onSessionChange?: (session: TabSession | DocsTabSession) => void;
};

const defaultSession: TabSession = { paths: [], activePath: null };

export async function runCloseBarrier(
  persistAll: () => Promise<boolean>,
  destroyWindow: () => Promise<void>,
): Promise<boolean> {
  if (!(await persistAll())) return false;
  await destroyWindow();
  return true;
}

export function useLibraryWorkspace(
  root: string,
  options: WorkspaceOptions = { defaultMode: "edit" },
) {
  const [snapshot, setSnapshot] = useState<LibrarySnapshot>(emptySnapshot);
  const [snapshotRoot, setSnapshotRoot] = useState(root);
  const [selectedFolder, setSelectedFolderState] = useState("");
  const [documents, setDocuments] = useState<Map<string, InternalDocument>>(
    new Map(),
  );
  const [activePath, setActivePathState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snippetCache, setSnippetCache] = useState<
    Map<string, SnippetCacheEntry>
  >(new Map());
  const documentsRef = useRef(documents);
  const snapshotRootRef = useRef(root);
  const snippetCacheRef = useRef(snippetCache);
  const snippetScopeRef = useRef({ root, keys: new Set<string>() });
  const mountedRef = useRef(true);
  const activePathRef = useRef(activePath);
  const savePromisesRef = useRef(new Map<string, Promise<boolean>>());
  const snippetRequestsRef = useRef(new Set<string>());
  const defaultModeRef = useRef(options.defaultMode);
  const globalDocumentsRef = useRef(options.globalDocuments === true);
  const initialSessionRef = useRef(options.initialSession ?? defaultSession);
  const initializedRef = useRef(false);
  const onSessionChangeRef = useRef(options.onSessionChange);
  onSessionChangeRef.current = options.onSessionChange;

  const commitDocuments = useCallback((next: Map<string, InternalDocument>) => {
    documentsRef.current = next;
    setDocuments(next);
  }, []);

  const commitSnippetCache = useCallback(
    (next: Map<string, SnippetCacheEntry>) => {
      snippetCacheRef.current = next;
      setSnippetCache(next);
    },
    [],
  );

  const commitSnapshot = useCallback(
    (ownerRoot: string, next: LibrarySnapshot) => {
      snapshotRootRef.current = ownerRoot;
      setSnapshotRoot(ownerRoot);
      setSnapshot(next);
    },
    [],
  );

  const setActivePath = useCallback((path: string | null) => {
    activePathRef.current = path;
    setActivePathState(path);
  }, []);

  const refresh = useCallback(async () => {
    const ownerRoot = snapshotRootRef.current;
    try {
      const next = await scanLibrary(ownerRoot);
      if (snapshotRootRef.current !== ownerRoot) return null;
      setSnapshot(next);
      setSelectedFolderState((current) => {
        if (
          current === "" ||
          next.folders.some((folder) => folder.path === current)
        ) {
          return current;
        }
        return "";
      });
      setErrorMessage(null);
      return next;
    } catch (cause) {
      if (snapshotRootRef.current !== ownerRoot) return null;
      setErrorMessage(messageFrom(cause));
      return null;
    }
  }, []);

  useEffect(() => {
    if (
      globalDocumentsRef.current &&
      initializedRef.current &&
      root === snapshotRootRef.current
    ) {
      return;
    }
    let cancelled = false;
    commitSnapshot(root, emptySnapshot);
    if (!globalDocumentsRef.current || !initializedRef.current) {
      setSelectedFolderState("");
      commitDocuments(new Map());
      setActivePath(null);
    }
    setLoading(true);
    setErrorMessage(null);
    commitSnippetCache(new Map());
    if (!globalDocumentsRef.current || !initializedRef.current) {
      savePromisesRef.current.clear();
    }
    snippetRequestsRef.current.clear();

    const restore = async () => {
      const nextSnapshot = await refresh();
      if (!nextSnapshot || cancelled) {
        if (!cancelled) setLoading(false);
        return;
      }
      if (globalDocumentsRef.current && initializedRef.current) {
        setLoading(false);
        return;
      }
      const initialReferences = initialDocumentRefs(
        initialSessionRef.current,
        root,
      );
      const existingPaths = new Set(
        nextSnapshot.documents.map((document) => document.path),
      );
      const references = globalDocumentsRef.current
        ? initialReferences
        : initialReferences.filter((reference) =>
            existingPaths.has(reference.path),
          );
      const restored = await Promise.all(
        references.map(async (reference) => {
          try {
            const payload = await readDocument(reference.root, reference.path);
            return toInternalDocument(
              reference.root,
              payload.path,
              payload.mtimeMs,
              parseMarkdown(payload.content),
              defaultModeRef.current,
            );
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      const nextDocuments = new Map<string, InternalDocument>();
      for (const document of restored) {
        if (document) {
          nextDocuments.set(
            documentIdentity(
              document.root,
              document.path,
              globalDocumentsRef.current,
            ),
            document,
          );
        }
      }
      const requestedActive = activeDocumentIdentity(
        initialSessionRef.current,
        root,
        globalDocumentsRef.current,
      );
      const restoredActive =
        requestedActive && nextDocuments.has(requestedActive)
          ? requestedActive
          : (nextDocuments.keys().next().value ?? null);
      const restoredActiveDocument = restoredActive
        ? nextDocuments.get(restoredActive)
        : null;
      if (
        globalDocumentsRef.current &&
        restoredActiveDocument &&
        restoredActiveDocument.root !== snapshotRootRef.current
      ) {
        commitSnapshot(restoredActiveDocument.root, emptySnapshot);
        const activeSnapshot = await refresh();
        if (!activeSnapshot || cancelled) {
          if (!cancelled) setLoading(false);
          return;
        }
      }
      commitDocuments(nextDocuments);
      setActivePath(restoredActive);
      if (globalDocumentsRef.current && restoredActiveDocument) {
        setSelectedFolderState(parentPath(restoredActiveDocument.path));
      }
      initializedRef.current = true;
      setLoading(false);
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, [
    commitDocuments,
    commitSnapshot,
    commitSnippetCache,
    refresh,
    root,
    setActivePath,
  ]);

  useEffect(() => {
    if (loading) return;
    if (globalDocumentsRef.current) {
      const references = [...documents.values()].map(({ root, path }) => ({
        root,
        path,
      }));
      const active = activePath
        ? (references.find(
            (reference) =>
              documentIdentity(reference.root, reference.path, true) ===
              activePath,
          ) ?? null)
        : null;
      onSessionChangeRef.current?.({ documents: references, active });
    } else {
      onSessionChangeRef.current?.({
        paths: [...documents.values()].map((document) => document.path),
        activePath,
      });
    }
  }, [activePath, documents, loading]);

  const visibleDocuments = useMemo(
    () =>
      snapshot.documents.filter(
        (document) => document.parent === selectedFolder,
      ),
    [selectedFolder, snapshot.documents],
  );
  const snippetScope = useMemo(
    () => ({
      root: snapshotRoot,
      keys: new Set(
        visibleDocuments.map((document) =>
          snippetKey(snapshotRoot, document.path, document.updatedMs),
        ),
      ),
    }),
    [snapshotRoot, visibleDocuments],
  );

  useEffect(() => {
    snippetScopeRef.current = snippetScope;
  }, [snippetScope]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const pending = visibleDocuments.filter((document) => {
      const cached = snippetCacheRef.current.get(
        documentIdentity(snapshotRoot, document.path, true),
      );
      const key = snippetKey(snapshotRoot, document.path, document.updatedMs);
      return (
        cached?.updatedMs !== document.updatedMs &&
        !snippetRequestsRef.current.has(key)
      );
    });
    if (pending.length === 0) return;

    const keys = pending.map((document) =>
      snippetKey(snapshotRoot, document.path, document.updatedMs),
    );
    for (const key of keys) snippetRequestsRef.current.add(key);
    void readDocumentSnippets(
      snapshotRoot,
      pending.map((document) => document.path),
    )
      .then((results) => {
        if (
          !mountedRef.current ||
          snippetScopeRef.current.root !== snapshotRoot
        )
          return;
        const requested = new Map(
          pending.map((document) => [document.path, document]),
        );
        const next = new Map(snippetCacheRef.current);
        let changed = false;
        for (const result of results) {
          const document = requested.get(result.path);
          if (
            !document ||
            result.snippet == null ||
            !snippetScopeRef.current.keys.has(
              snippetKey(snapshotRoot, document.path, document.updatedMs),
            )
          ) {
            continue;
          }
          next.set(documentIdentity(snapshotRoot, result.path, true), {
            updatedMs: document.updatedMs,
            snippet: result.snippet,
          });
          changed = true;
        }
        if (changed) commitSnippetCache(next);
      })
      .catch(() => undefined)
      .finally(() => {
        for (const key of keys) snippetRequestsRef.current.delete(key);
      });
  }, [commitSnippetCache, snapshotRoot, visibleDocuments]);

  const updateDocument = useCallback(
    (path: string, update: (current: InternalDocument) => InternalDocument) => {
      const current = documentsRef.current.get(path);
      if (!current) return;
      const next = new Map(documentsRef.current);
      next.set(path, update(current));
      commitDocuments(next);
    },
    [commitDocuments],
  );

  const persistDocument = useCallback(
    async (path: string): Promise<boolean> => {
      const pending = savePromisesRef.current.get(path);
      if (pending) {
        const saved = await pending;
        const latest = documentsRef.current.get(path);
        if (!saved || !latest?.dirty) return saved;
      }

      const current = documentsRef.current.get(path);
      if (!current || !current.dirty) return true;
      const timestamp = new Date().toISOString();
      const markdown = withUpdatedBody(current, current.body, timestamp);
      updateDocument(path, (latest) => ({ ...latest, saveStatus: "saving" }));

      const savePromise = saveDocument(
        current.root,
        current.path,
        serializeMarkdown(markdown),
        current.mtimeMs,
      )
        .then(async (payload) => {
          const parsed = parseMarkdown(payload.content);
          updateDocument(path, (latest) => {
            const unchanged = latest.revision === current.revision;
            return {
              ...latest,
              created: parsed.created,
              updated: parsed.updated,
              mtimeMs: payload.mtimeMs,
              dirty: !unchanged,
              saveStatus: unchanged ? "saved" : "dirty",
            };
          });
          const key = snippetKey(current.root, payload.path, payload.mtimeMs);
          snippetRequestsRef.current.add(key);
          if (current.root === snapshotRootRef.current) {
            setSnapshot((currentSnapshot) =>
              updateSnapshotMtime(
                currentSnapshot,
                payload.path,
                payload.mtimeMs,
              ),
            );
          }
          try {
            const [result] = await readDocumentSnippets(current.root, [
              payload.path,
            ]);
            if (result?.snippet != null) {
              const next = new Map(snippetCacheRef.current);
              next.set(documentIdentity(current.root, payload.path, true), {
                updatedMs: payload.mtimeMs,
                snippet: result.snippet,
              });
              commitSnippetCache(next);
            }
          } catch (cause) {
            void cause;
          } finally {
            snippetRequestsRef.current.delete(key);
          }
          setErrorMessage(null);
          return true;
        })
        .catch((cause: unknown) => {
          updateDocument(path, (latest) => ({
            ...latest,
            saveStatus: "error",
          }));
          setErrorMessage(messageFrom(cause));
          return false;
        })
        .finally(() => {
          if (savePromisesRef.current.get(path) === savePromise) {
            savePromisesRef.current.delete(path);
          }
        });

      savePromisesRef.current.set(path, savePromise);
      return await savePromise;
    },
    [commitSnippetCache, updateDocument],
  );

  const persistAllOpenDocuments = useCallback(async (): Promise<boolean> => {
    const paths = [...documentsRef.current.keys()];
    const results = await Promise.all(paths.map(persistDocument));
    return results.every(Boolean);
  }, [persistDocument]);

  useEffect(() => {
    const dirtyPaths = [...documents]
      .filter(
        ([, document]) => document.dirty && document.saveStatus === "dirty",
      )
      .map(([path]) => path);
    if (dirtyPaths.length === 0) return;
    const timer = window.setTimeout(() => {
      for (const path of dirtyPaths) void persistDocument(path);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [documents, persistDocument]);

  const setActiveDocument = useCallback(
    (path: string) => {
      if (!documentsRef.current.has(path) || activePathRef.current === path)
        return;
      const previous = activePathRef.current;
      setActivePath(path);
      if (previous) void persistDocument(previous);
    },
    [persistDocument, setActivePath],
  );

  const openDocument = useCallback(
    async (path: string) => {
      const identity = documentIdentity(root, path, globalDocumentsRef.current);
      if (documentsRef.current.has(identity)) {
        setActiveDocument(identity);
        return true;
      }
      try {
        const payload = await readDocument(root, path);
        const opened = toInternalDocument(
          root,
          payload.path,
          payload.mtimeMs,
          parseMarkdown(payload.content),
          defaultModeRef.current,
        );
        const next = new Map(documentsRef.current);
        next.set(identity, opened);
        commitDocuments(next);
        const previous = activePathRef.current;
        setActivePath(identity);
        if (previous) void persistDocument(previous);
        setErrorMessage(null);
        return true;
      } catch (cause) {
        setErrorMessage(messageFrom(cause));
        return false;
      }
    },
    [commitDocuments, persistDocument, root, setActiveDocument, setActivePath],
  );

  const openDocumentReference = useCallback(
    async (reference: DocsDocumentRef): Promise<boolean> => {
      const identity = documentIdentity(reference.root, reference.path, true);
      if (documentsRef.current.has(identity)) {
        const previous = activePathRef.current;
        if (
          previous &&
          previous !== identity &&
          !(await persistDocument(previous))
        ) {
          return false;
        }
        try {
          const nextSnapshot = await scanLibrary(reference.root);
          commitSnapshot(reference.root, nextSnapshot);
          setSelectedFolderState(parentPath(reference.path));
          setActivePath(identity);
          setErrorMessage(null);
          return true;
        } catch (cause) {
          setErrorMessage(messageFrom(cause));
          return false;
        }
      }
      const previous = activePathRef.current;
      if (previous && !(await persistDocument(previous))) return false;
      try {
        const [nextSnapshot, payload] = await Promise.all([
          scanLibrary(reference.root),
          readDocument(reference.root, reference.path),
        ]);
        const opened = toInternalDocument(
          reference.root,
          payload.path,
          payload.mtimeMs,
          parseMarkdown(payload.content),
          defaultModeRef.current,
        );
        const next = new Map(documentsRef.current);
        next.set(identity, opened);
        commitSnapshot(reference.root, nextSnapshot);
        setSelectedFolderState(parentPath(opened.path));
        commitDocuments(next);
        setActivePath(identity);
        setErrorMessage(null);
        return true;
      } catch (cause) {
        setErrorMessage(messageFrom(cause));
        return false;
      }
    },
    [commitDocuments, commitSnapshot, persistDocument, setActivePath],
  );

  const closeDocument = useCallback(
    async (path: string): Promise<boolean> => {
      if (!(await persistDocument(path))) return false;
      const paths = [...documentsRef.current.keys()];
      const index = paths.indexOf(path);
      const closingActive = activePathRef.current === path;
      const fallback = closingActive
        ? (paths[index + 1] ?? paths[index - 1] ?? null)
        : null;
      if (globalDocumentsRef.current && fallback) {
        const target = documentsRef.current.get(fallback);
        if (target && target.root !== snapshotRootRef.current) {
          try {
            const nextSnapshot = await scanLibrary(target.root);
            commitSnapshot(target.root, nextSnapshot);
            setSelectedFolderState(parentPath(target.path));
          } catch (cause) {
            setErrorMessage(messageFrom(cause));
            return false;
          }
        }
      }
      const next = new Map(documentsRef.current);
      next.delete(path);
      commitDocuments(next);
      if (closingActive) {
        setActivePath(fallback);
      }
      return true;
    },
    [commitDocuments, commitSnapshot, persistDocument, setActivePath],
  );

  const updateBody = useCallback(
    (body: string) => {
      const path = activePathRef.current;
      if (!path) return;
      updateDocument(path, (current) => ({
        ...current,
        body,
        dirty: true,
        revision: current.revision + 1,
        saveStatus: "dirty",
      }));
    },
    [updateDocument],
  );

  const setMode = useCallback(
    (mode: EditorMode) => {
      const path = activePathRef.current;
      if (!path) return;
      updateDocument(path, (current) => ({ ...current, mode }));
    },
    [updateDocument],
  );

  const addDocument = useCallback(
    async (title: string) => {
      const timestamp = new Date().toISOString();
      try {
        const payload = await createDocument(
          root,
          selectedFolder,
          title,
          serializeMarkdown({
            created: timestamp,
            updated: timestamp,
            body: "",
          }),
        );
        await refresh();
        const opened = toInternalDocument(
          root,
          payload.path,
          payload.mtimeMs,
          parseMarkdown(payload.content),
          defaultModeRef.current,
        );
        const next = new Map(documentsRef.current);
        const identity = documentIdentity(
          root,
          opened.path,
          globalDocumentsRef.current,
        );
        next.set(identity, opened);
        commitDocuments(next);
        const previous = activePathRef.current;
        setActivePath(identity);
        if (previous) void persistDocument(previous);
        setErrorMessage(null);
      } catch (cause) {
        setErrorMessage(messageFrom(cause));
      }
    },
    [
      commitDocuments,
      persistDocument,
      refresh,
      root,
      selectedFolder,
      setActivePath,
    ],
  );

  const addFolder = useCallback(
    async (name: string) => {
      try {
        await createFolder(root, selectedFolder, name);
        await refresh();
        setErrorMessage(null);
      } catch (cause) {
        setErrorMessage(messageFrom(cause));
      }
    },
    [refresh, root, selectedFolder],
  );

  const renameActive = useCallback(
    async (title: string) => {
      const identity = activePathRef.current;
      if (!identity || !(await persistDocument(identity))) return;
      const current = documentsRef.current.get(identity);
      if (!current) return;
      const timestamp = new Date().toISOString();
      try {
        const payload = await renameDocument(
          current.root,
          current.path,
          title,
          serializeMarkdown(withUpdatedBody(current, current.body, timestamp)),
          current.mtimeMs,
        );
        const renamed = {
          ...toInternalDocument(
            current.root,
            payload.path,
            payload.mtimeMs,
            parseMarkdown(payload.content),
            current.mode,
          ),
          saveStatus: "saved" as const,
        };
        replaceDocumentPath(
          identity,
          renamed,
          documentsRef.current,
          commitDocuments,
          globalDocumentsRef.current,
        );
        setActivePath(
          documentIdentity(
            renamed.root,
            renamed.path,
            globalDocumentsRef.current,
          ),
        );
        await refresh();
        setErrorMessage(null);
      } catch (cause) {
        updateDocument(identity, (latest) => ({
          ...latest,
          saveStatus: "error",
        }));
        setErrorMessage(messageFrom(cause));
      }
    },
    [commitDocuments, persistDocument, refresh, setActivePath, updateDocument],
  );

  const renameFolderAt = useCallback(
    async (path: string, name: string) => {
      if (path === "" || !(await persistAllOpenDocuments())) return;
      try {
        const active = activePathRef.current
          ? documentsRef.current.get(activePathRef.current)
          : null;
        const mutation = await renameFolder(root, path, name);
        rebaseDocuments(
          root,
          path,
          mutation.path,
          documentsRef.current,
          commitDocuments,
          globalDocumentsRef.current,
        );
        setSelectedFolderState(mutation.path);
        if (active?.root === root && isWithin(active.path, path)) {
          setActivePath(
            documentIdentity(
              root,
              rebasePath(active.path, path, mutation.path),
              globalDocumentsRef.current,
            ),
          );
        }
        await refresh();
        setErrorMessage(null);
      } catch (cause) {
        setErrorMessage(messageFrom(cause));
      }
    },
    [commitDocuments, persistAllOpenDocuments, refresh, root, setActivePath],
  );

  const moveActive = useCallback(
    async (destination: string) => {
      const identity = activePathRef.current;
      if (!identity || !(await persistDocument(identity))) return;
      const current = documentsRef.current.get(identity);
      if (!current) return;
      try {
        const mutation = await moveEntry(
          current.root,
          current.path,
          destination,
        );
        const moved = { ...current, path: mutation.path };
        replaceDocumentPath(
          identity,
          moved,
          documentsRef.current,
          commitDocuments,
          globalDocumentsRef.current,
        );
        setActivePath(
          documentIdentity(moved.root, moved.path, globalDocumentsRef.current),
        );
        setSelectedFolderState(destination);
        await refresh();
        setErrorMessage(null);
      } catch (cause) {
        setErrorMessage(messageFrom(cause));
      }
    },
    [commitDocuments, persistDocument, refresh, setActivePath],
  );

  const moveFolderAt = useCallback(
    async (path: string, destination: string) => {
      if (path === "" || !(await persistAllOpenDocuments())) return;
      try {
        const active = activePathRef.current
          ? documentsRef.current.get(activePathRef.current)
          : null;
        const mutation = await moveEntry(root, path, destination);
        rebaseDocuments(
          root,
          path,
          mutation.path,
          documentsRef.current,
          commitDocuments,
          globalDocumentsRef.current,
        );
        if (active?.root === root && isWithin(active.path, path)) {
          setActivePath(
            documentIdentity(
              root,
              rebasePath(active.path, path, mutation.path),
              globalDocumentsRef.current,
            ),
          );
        }
        setSelectedFolderState(mutation.path);
        await refresh();
        setErrorMessage(null);
      } catch (cause) {
        setErrorMessage(messageFrom(cause));
      }
    },
    [commitDocuments, persistAllOpenDocuments, refresh, root, setActivePath],
  );

  const removeActive = useCallback(async () => {
    const identity = activePathRef.current;
    if (!identity) return;
    const current = documentsRef.current.get(identity);
    if (!current) return;
    try {
      await trashEntry(current.root, current.path);
      const paths = [...documentsRef.current.keys()];
      const index = paths.indexOf(identity);
      const next = new Map(documentsRef.current);
      next.delete(identity);
      commitDocuments(next);
      setActivePath(paths[index + 1] ?? paths[index - 1] ?? null);
      await refresh();
      setErrorMessage(null);
    } catch (cause) {
      setErrorMessage(messageFrom(cause));
    }
  }, [commitDocuments, refresh, setActivePath]);

  const removeFolderAt = useCallback(
    async (path: string) => {
      if (path === "") return;
      try {
        await trashEntry(root, path);
        const next = new Map(
          [...documentsRef.current].filter(
            ([, document]) =>
              document.root !== root || !isWithin(document.path, path),
          ),
        );
        commitDocuments(next);
        const active = activePathRef.current
          ? documentsRef.current.get(activePathRef.current)
          : null;
        if (active?.root === root && isWithin(active.path, path)) {
          setActivePath(next.keys().next().value ?? null);
        }
        setSelectedFolderState("");
        await refresh();
        setErrorMessage(null);
      } catch (cause) {
        setErrorMessage(messageFrom(cause));
      }
    },
    [commitDocuments, refresh, root, setActivePath],
  );

  const openDocuments = useMemo<readonly WorkspaceDocument[]>(
    () =>
      [...documents.values()].map(({ dirty, revision, ...document }) => {
        void dirty;
        void revision;
        return document;
      }),
    [documents],
  );
  const activeDocument = activePath
    ? (openDocuments.find(
        (document) =>
          documentIdentity(
            document.root,
            document.path,
            globalDocumentsRef.current,
          ) === activePath,
      ) ?? null)
    : null;
  const visibleSnippets = useMemo(
    () =>
      new Map(
        visibleDocuments.flatMap((document) => {
          const cached = snippetCache.get(
            documentIdentity(snapshotRoot, document.path, true),
          );
          return cached?.updatedMs === document.updatedMs
            ? [[document.path, cached.snippet] as const]
            : [];
        }),
      ),
    [snapshotRoot, snippetCache, visibleDocuments],
  );

  const activateDocument = useCallback(
    async (reference: DocsDocumentRef): Promise<boolean> => {
      const identity = documentIdentity(reference.root, reference.path, true);
      if (!documentsRef.current.has(identity)) return false;
      const previous = activePathRef.current;
      if (
        previous &&
        previous !== identity &&
        !(await persistDocument(previous))
      ) {
        return false;
      }
      try {
        const nextSnapshot = await scanLibrary(reference.root);
        commitSnapshot(reference.root, nextSnapshot);
        setSelectedFolderState(parentPath(reference.path));
        setActivePath(identity);
        setErrorMessage(null);
        return true;
      } catch (cause) {
        setErrorMessage(messageFrom(cause));
        return false;
      }
    },
    [commitSnapshot, persistDocument, setActivePath],
  );

  return {
    snapshot,
    visibleDocuments,
    visibleSnippets,
    selectedFolder,
    openDocuments,
    activePath: activeDocument?.path ?? null,
    activeIdentity: activePath,
    activeReference: activeDocument
      ? { root: activeDocument.root, path: activeDocument.path }
      : null,
    activeDocument,
    loading,
    errorMessage,
    saveStatus: activeDocument?.saveStatus ?? "idle",
    setSelectedFolder: setSelectedFolderState,
    setActiveDocument,
    activateDocument,
    openDocument,
    openDocumentReference,
    closeDocument,
    updateBody,
    setMode,
    addDocument,
    addFolder,
    renameActive,
    renameFolderAt,
    moveActive,
    moveFolderAt,
    removeActive,
    removeFolderAt,
    persistCurrent: async () =>
      activePathRef.current
        ? await persistDocument(activePathRef.current)
        : true,
    persistAllOpenDocuments,
    documentIdentity: (document: WorkspaceDocument) =>
      documentIdentity(
        document.root,
        document.path,
        globalDocumentsRef.current,
      ),
    refresh,
    clearError: () => setErrorMessage(null),
  };
}

function toInternalDocument(
  root: string,
  path: string,
  mtimeMs: number,
  document: ReturnType<typeof parseMarkdown>,
  mode: EditorMode,
): InternalDocument {
  return {
    root,
    path,
    title: titleFromPath(path),
    created: document.created,
    updated: document.updated,
    body: document.body,
    mtimeMs,
    mode,
    saveStatus: "idle",
    dirty: false,
    revision: 0,
  };
}

function documentIdentity(
  root: string,
  path: string,
  globalDocuments: boolean,
): string {
  return globalDocuments ? `${root}\0${path}` : path;
}

function initialDocumentRefs(
  session: TabSession | DocsTabSession,
  root: string,
): readonly DocsDocumentRef[] {
  return "documents" in session
    ? session.documents
    : session.paths.map((path) => ({ root, path }));
}

function activeDocumentIdentity(
  session: TabSession | DocsTabSession,
  root: string,
  globalDocuments: boolean,
): string | null {
  if ("documents" in session) {
    return session.active
      ? documentIdentity(session.active.root, session.active.path, true)
      : null;
  }
  return session.activePath
    ? documentIdentity(root, session.activePath, globalDocuments)
    : null;
}

function replaceDocumentPath(
  fromIdentity: string,
  replacement: InternalDocument,
  documents: Map<string, InternalDocument>,
  commit: (documents: Map<string, InternalDocument>) => void,
  globalDocuments: boolean,
) {
  const next = new Map<string, InternalDocument>();
  for (const [identity, document] of documents) {
    next.set(
      identity === fromIdentity
        ? documentIdentity(replacement.root, replacement.path, globalDocuments)
        : identity,
      identity === fromIdentity ? replacement : document,
    );
  }
  commit(next);
}

function rebaseDocuments(
  root: string,
  from: string,
  to: string,
  documents: Map<string, InternalDocument>,
  commit: (documents: Map<string, InternalDocument>) => void,
  globalDocuments: boolean,
) {
  const next = new Map<string, InternalDocument>();
  for (const [identity, document] of documents) {
    if (document.root === root && isWithin(document.path, from)) {
      const rebased = rebasePath(document.path, from, to);
      next.set(documentIdentity(root, rebased, globalDocuments), {
        ...document,
        path: rebased,
      });
    } else {
      next.set(identity, document);
    }
  }
  commit(next);
}

function titleFromPath(path: string): string {
  const fileName = path.split("/").at(-1) ?? path;
  return fileName.endsWith(".md") ? fileName.slice(0, -3) : fileName;
}

function parentPath(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

function isWithin(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

function rebasePath(path: string, from: string, to: string): string {
  if (path === from) return to;
  return `${to}${path.slice(from.length)}`;
}

function messageFrom(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (typeof cause === "string") return cause;
  return "알 수 없는 파일시스템 오류가 발생했습니다.";
}

function snippetKey(root: string, path: string, updatedMs: number): string {
  return `${root}\u0000${path}\u0000${updatedMs}`;
}

function updateSnapshotMtime(
  snapshot: LibrarySnapshot,
  path: string,
  updatedMs: number,
): LibrarySnapshot {
  const documents = snapshot.documents
    .map(
      (document): DocumentEntry =>
        document.path === path ? { ...document, updatedMs } : document,
    )
    .sort((left, right) =>
      right.updatedMs === left.updatedMs
        ? left.path.localeCompare(right.path)
        : right.updatedMs - left.updatedMs,
    );
  return { ...snapshot, documents };
}
