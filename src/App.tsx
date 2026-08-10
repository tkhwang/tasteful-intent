import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, confirm as showConfirmation } from "@tauri-apps/plugin-dialog";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  Columns2,
  Eye,
  PanelLeft,
  PencilLine,
  Plus,
  RefreshCw,
  Rows2,
  Rows3,
  Rows4,
  Settings,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocsRootSwitcher } from "@/components/DocsRootSwitcher";
import { DocumentList } from "@/components/DocumentList";
import { FolderTree } from "@/components/FolderTree";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownView } from "@/components/MarkdownView";
import { MoveDialog } from "@/components/MoveDialog";
import { NameDialog } from "@/components/NameDialog";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { PrimitiveShowcase } from "@/components/PrimitiveShowcase";
import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { TabBar } from "@/components/TabBar";
import {
  runCloseBarrier,
  useLibraryWorkspace,
} from "@/hooks/useLibraryWorkspace";
import { getMessages, I18nProvider, type Messages, useI18n } from "@/lib/i18n";
import { NativeCommandError, resolveDocumentSource } from "@/lib/native";
import { formatRootDisplay } from "@/lib/rootDisplay";
import { loadSettings, nextPaneLayout, saveSettings } from "@/lib/settings";
import { applyResolvedTheme, resolveTheme } from "@/lib/theme";
import type {
  DocsDocumentRef,
  DocsTabSession,
  DocumentDensity,
  EditorMode,
  LayoutSettings,
  Space,
  TabSession,
} from "@/types/library";

type DialogKind =
  | "document"
  | "folder"
  | "rename-document"
  | "rename-folder"
  | null;

type MoveTarget = {
  readonly kind: "document" | "folder";
  readonly path: string;
};

type ModeControl = {
  readonly icon: LucideIcon;
  readonly next: EditorMode;
};

type DensityControl = {
  readonly icon: LucideIcon;
  readonly next: DocumentDensity;
};

type SettingsUpdater = (current: LayoutSettings) => LayoutSettings;
type SettingsChange = (update: SettingsUpdater) => Promise<void>;

const DOCUMENT_SOURCE_VALIDATION_CODES = new Set([
  "hidden-path",
  "invalid-document",
  "invalid-document-source",
]);

async function resolveDocumentSourceForOpen(
  path: string,
  onValidationError: (message: string) => void,
): Promise<DocsDocumentRef | null> {
  try {
    return await resolveDocumentSource(path);
  } catch (cause) {
    if (
      cause instanceof NativeCommandError &&
      DOCUMENT_SOURCE_VALIDATION_CODES.has(cause.code)
    ) {
      onValidationError(cause.message);
      return null;
    }
    throw cause;
  }
}

const MODE_CONTROLS = {
  edit: {
    icon: PencilLine,
    next: "view",
  },
  view: {
    icon: Eye,
    next: "split",
  },
  split: {
    icon: Columns2,
    next: "edit",
  },
} satisfies Record<EditorMode, ModeControl>;

const DENSITY_CONTROLS = {
  full: {
    icon: Rows4,
    next: "medium",
  },
  medium: {
    icon: Rows3,
    next: "simple",
  },
  simple: {
    icon: Rows2,
    next: "full",
  },
} satisfies Record<DocumentDensity, DensityControl>;

type WindowFrameProps = {
  readonly children: ReactNode;
  readonly documentTitle?: string;
};

function WindowFrame({ children, documentTitle }: WindowFrameProps) {
  return (
    <div className="window-frame">
      <header className="window-titlebar" data-tauri-drag-region>
        <strong className="window-titlebar-service" data-tauri-drag-region>
          Tasteful Intent
        </strong>
        {documentTitle ? (
          <span className="window-titlebar-document" data-tauri-drag-region>
            {documentTitle}
          </span>
        ) : null}
      </header>
      <div className="window-content">{children}</div>
    </div>
  );
}

export function App() {
  if (new URLSearchParams(window.location.search).has("showcase")) {
    return <PrimitiveShowcase />;
  }

  return <RuntimeApp />;
}

function RuntimeApp() {
  const [settings, setSettings] = useState<LayoutSettings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const settingsRef = useRef<LayoutSettings | null>(null);
  const settingsWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
  const theme = settings?.theme ?? "light";
  const language = settings?.language ?? "en";
  const writingFont = settings?.writingFont ?? "sans";

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyResolvedTheme(resolveTheme(theme, media.matches));
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.writingFont = writingFont;
  }, [writingFont]);

  useEffect(() => {
    loadSettings()
      .then((loaded) => {
        settingsRef.current = loaded;
        setSettings(loaded);
      })
      .catch((cause: unknown) => {
        setLoadError(
          cause instanceof Error
            ? cause.message
            : getMessages("en").app.loadError,
        );
      });
  }, []);

  const updateSettings = useCallback<SettingsChange>((update) => {
    const current = settingsRef.current;
    if (!current) return Promise.resolve();
    const next = update(current);
    if (Object.is(current, next)) return Promise.resolve();
    settingsRef.current = next;
    setSettings(next);
    const write = settingsWriteQueueRef.current.then(() => saveSettings(next));
    settingsWriteQueueRef.current = write.then(
      () => undefined,
      () => undefined,
    );
    return write;
  }, []);

  return (
    <I18nProvider language={language}>
      <RuntimeContent
        loadError={loadError}
        onSettingsChange={updateSettings}
        settings={settings}
      />
    </I18nProvider>
  );
}

type RuntimeContentProps = {
  readonly loadError: string | null;
  readonly onSettingsChange: SettingsChange;
  readonly settings: LayoutSettings | null;
};

function RuntimeContent({
  loadError,
  onSettingsChange,
  settings,
}: RuntimeContentProps) {
  const messages = useI18n();
  const [documentSourceError, setDocumentSourceError] = useState<string | null>(
    null,
  );

  if (loadError) {
    return (
      <WindowFrame>
        <FatalScreen message={loadError} />
      </WindowFrame>
    );
  }

  if (!settings) {
    return (
      <WindowFrame>
        <LoadingScreen />
      </WindowFrame>
    );
  }

  if (!settings.libraryRoot) {
    return (
      <WindowFrame>
        <OnboardingScreen
          language={settings.language}
          onComplete={(libraryRoot) => {
            void onSettingsChange((current) => ({
              ...current,
              libraryRoot,
              activeSpace: "intent",
            }));
          }}
          onLanguageChange={(language) => {
            void onSettingsChange((current) => ({ ...current, language }));
          }}
          onThemeChange={(theme) => {
            void onSettingsChange((current) => ({ ...current, theme }));
          }}
          theme={settings.theme}
        />
      </WindowFrame>
    );
  }

  const root =
    settings.activeSpace === "intent"
      ? settings.libraryRoot
      : settings.tabSessions.docs.documents.length > 0
        ? settings.docsRoot
        : null;

  if (!root) {
    return (
      <WindowFrame>
        <DocsWelcomeScreen
          errorMessage={documentSourceError}
          onClearError={() => setDocumentSourceError(null)}
          onChoose={async () => {
            const path = await chooseDocument(messages.app.chooseDocsRoot);
            if (!path) return;
            const reference = await resolveDocumentSourceForOpen(
              path,
              setDocumentSourceError,
            );
            if (!reference) return;
            setDocumentSourceError(null);
            await onSettingsChange((current) => ({
              ...current,
              docsRoot: reference.root,
              tabSessions: {
                ...current.tabSessions,
                docs: {
                  documents: appendDocumentReference(
                    current.tabSessions.docs.documents,
                    reference,
                  ),
                  active: reference,
                },
              },
            }));
          }}
          onSpaceChange={async (space) => {
            await onSettingsChange((current) => ({
              ...current,
              activeSpace: space,
            }));
          }}
        />
      </WindowFrame>
    );
  }

  return (
    <LibraryApp
      key={settings.activeSpace === "docs" ? "docs" : `intent:${root}`}
      onSettingsChange={onSettingsChange}
      root={root}
      settings={settings}
    />
  );
}

type FatalScreenProps = {
  readonly message: string;
};

function FatalScreen({ message }: FatalScreenProps) {
  return (
    <main className="center-screen" role="alert">
      <p>{message}</p>
    </main>
  );
}

function LoadingScreen() {
  const messages = useI18n();
  return (
    <main className="center-screen">
      <p>{messages.app.loading}</p>
    </main>
  );
}

type DocsWelcomeScreenProps = {
  readonly errorMessage: string | null;
  readonly onClearError: () => void;
  readonly onChoose: () => Promise<void>;
  readonly onSpaceChange: (space: Space) => Promise<void>;
};

function DocsWelcomeScreen({
  errorMessage,
  onClearError,
  onChoose,
  onSpaceChange,
}: DocsWelcomeScreenProps) {
  const messages = useI18n();
  return (
    <main className="docs-welcome-screen" data-space="docs">
      <div className="welcome-switcher">
        <SpaceSwitcher activeSpace="docs" onChange={onSpaceChange} />
      </div>
      <div className="docs-welcome-copy">
        <p className="eyebrow">{messages.app.docsEyebrow}</p>
        <h1>{messages.app.docsTitle}</h1>
        <p>{messages.app.docsBody}</p>
        {errorMessage ? (
          <div className="inline-notice" role="alert">
            <span>{errorMessage}</span>
            <button
              aria-label={messages.app.closeError}
              className="icon-button"
              onClick={onClearError}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}
        <button
          className="primary-button welcome-action"
          onClick={() => void onChoose()}
          type="button"
        >
          {messages.app.chooseDocsRoot}
        </button>
      </div>
    </main>
  );
}

type LibraryAppProps = {
  readonly root: string;
  readonly settings: LayoutSettings;
  readonly onSettingsChange: SettingsChange;
};

function LibraryApp({ root, settings, onSettingsChange }: LibraryAppProps) {
  const messages = useI18n();
  const rootName = formatRootDisplay(root).leaf;
  const defaultMode = settings.activeSpace === "docs" ? "view" : "edit";
  const activeSpace = settings.activeSpace;
  const persistTabSession = useCallback(
    (session: TabSession | DocsTabSession) => {
      void onSettingsChange((current) => {
        if (
          activeSpace === "intent" && "paths" in session
            ? sameSession(current.tabSessions.intent, session)
            : activeSpace === "docs" && "documents" in session
              ? sameDocsSession(current.tabSessions.docs, session)
              : false
        ) {
          return current;
        }
        return {
          ...current,
          tabSessions: {
            ...current.tabSessions,
            ...(activeSpace === "intent" && "paths" in session
              ? { intent: session }
              : activeSpace === "docs" && "documents" in session
                ? { docs: session }
                : {}),
          },
        };
      });
    },
    [activeSpace, onSettingsChange],
  );
  const workspace = useLibraryWorkspace(root, {
    defaultMode,
    initialSession: settings.tabSessions[settings.activeSpace],
    globalDocuments: settings.activeSpace === "docs",
    onSessionChange: persistTabSession,
  });
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [dialogTargetPath, setDialogTargetPath] = useState<string | null>(null);
  const [documentSourceError, setDocumentSourceError] = useState<string | null>(
    null,
  );
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const actionOriginRef = useRef<HTMLElement | null>(null);
  const settingsOriginRef = useRef<HTMLButtonElement | null>(null);
  const folderVisible = settings.listPaneOpen && settings.folderPaneOpen;
  const layoutControl = !settings.listPaneOpen
    ? {
        label: messages.app.layoutFocus,
        state: "focus",
      }
    : folderVisible
      ? {
          label: messages.app.layoutFull,
          state: "full",
        }
      : {
          label: messages.app.layoutCompact,
          state: "compact",
        };
  const modeLabels = {
    edit: messages.app.modeEdit,
    view: messages.app.modeView,
    split: messages.app.modeSplit,
  } satisfies Record<EditorMode, string>;
  const modeControl = workspace.activeDocument
    ? {
        ...MODE_CONTROLS[workspace.activeDocument.mode],
        label: modeLabels[workspace.activeDocument.mode],
      }
    : null;
  const ModeIcon = modeControl?.icon ?? PencilLine;
  const densityLabels = {
    full: messages.app.densityFull,
    medium: messages.app.densityMedium,
    simple: messages.app.densitySimple,
  } satisfies Record<DocumentDensity, string>;
  const densityControl = DENSITY_CONTROLS[settings.documentDensity];
  const DensityIcon = densityControl.icon;
  const createDocumentLabel =
    settings.activeSpace === "intent"
      ? messages.app.newIntent
      : messages.app.newDocument;
  const createFolderLabel =
    settings.activeSpace === "intent"
      ? messages.app.newFolder
      : messages.app.newCollection;
  const createDocumentFieldLabel =
    settings.activeSpace === "intent"
      ? messages.dialogs.intentName
      : messages.dialogs.documentName;
  const createFolderFieldLabel =
    settings.activeSpace === "intent"
      ? messages.dialogs.folderName
      : messages.dialogs.collectionName;
  const documentCollator = useMemo(
    () =>
      new Intl.Collator(messages.locale, {
        numeric: true,
        sensitivity: "base",
      }),
    [messages.locale],
  );
  const sortedDocuments = useMemo(() => {
    if (settings.documentSort === "updated") {
      return workspace.visibleDocuments;
    }
    return [...workspace.visibleDocuments].sort((left, right) => {
      const titleOrder = documentCollator.compare(left.title, right.title);
      return titleOrder || documentCollator.compare(left.path, right.path);
    });
  }, [documentCollator, settings.documentSort, workspace.visibleDocuments]);

  const updateLayout = useCallback(
    (partial: Partial<LayoutSettings>) => {
      void onSettingsChange((current) => ({ ...current, ...partial }));
    },
    [onSettingsChange],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey)
        return;
      if (event.key === "1") {
        event.preventDefault();
        if (settings.listPaneOpen) {
          updateLayout({ folderPaneOpen: !settings.folderPaneOpen });
        }
      }
      if (event.key === "2") {
        event.preventDefault();
        updateLayout({ listPaneOpen: !settings.listPaneOpen });
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [settings.folderPaneOpen, settings.listPaneOpen, updateLayout]);

  const folderOptions = useMemo(
    () => [{ path: "", name: rootName }, ...workspace.snapshot.folders],
    [rootName, workspace.snapshot.folders],
  );

  const moveDestinations = useMemo(() => {
    if (!moveTarget) return [];
    if (moveTarget.kind === "document") {
      const currentParent = parentPath(moveTarget.path);
      return folderOptions.filter((folder) => folder.path !== currentParent);
    }
    return folderOptions.filter(
      (folder) =>
        folder.path !== parentPath(moveTarget.path) &&
        folder.path !== moveTarget.path &&
        !folder.path.startsWith(`${moveTarget.path}/`),
    );
  }, [folderOptions, moveTarget]);

  const restoreActionFocus = useCallback(() => {
    const origin = actionOriginRef.current;
    actionOriginRef.current = null;
    window.requestAnimationFrame(() => {
      if (origin?.isConnected) origin.focus();
    });
  }, []);

  const closeActionDialog = useCallback(() => {
    setDialog(null);
    setDialogTargetPath(null);
    setMoveTarget(null);
    restoreActionFocus();
  }, [restoreActionFocus]);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    const origin = settingsOriginRef.current;
    settingsOriginRef.current = null;
    window.requestAnimationFrame(() => {
      if (origin?.isConnected) origin.focus();
    });
  }, []);

  const openSettings = (origin: HTMLButtonElement) => {
    settingsOriginRef.current = origin;
    setSettingsOpen(true);
  };

  const handleRootChange = async () => {
    if (!(await workspace.persistAllOpenDocuments())) return;
    const nextRoot = await chooseLibrary(messages.app.chooseIntentRoot);
    if (!nextRoot) return;
    await onSettingsChange((current) => ({
      ...current,
      libraryRoot: nextRoot,
    }));
  };

  const openAiDocument = async () => {
    const path = await chooseDocument(messages.app.chooseDocsRoot);
    if (!path) return;
    const reference = await resolveDocumentSourceForOpen(
      path,
      setDocumentSourceError,
    );
    if (!reference) return;
    setDocumentSourceError(null);
    if (!(await workspace.openDocumentReference(reference))) return;
    await onSettingsChange((current) => ({
      ...current,
      docsRoot: reference.root,
      tabSessions: {
        ...current.tabSessions,
        docs: {
          documents: appendDocumentReference(
            current.tabSessions.docs.documents,
            reference,
          ),
          active: reference,
        },
      },
    }));
  };

  const selectTab = async (identity: string) => {
    if (activeSpace === "intent") {
      workspace.setActiveDocument(identity);
      return;
    }
    const document = workspace.openDocuments.find(
      (candidate) => workspace.documentIdentity(candidate) === identity,
    );
    if (!document) return;
    const reference = { root: document.root, path: document.path };
    if (!(await workspace.activateDocument(reference))) return;
    await onSettingsChange((current) => ({
      ...current,
      docsRoot: reference.root,
    }));
  };

  const closeTab = async (identity: string) => {
    if (activeSpace === "intent") {
      await workspace.closeDocument(identity);
      return;
    }
    const index = workspace.openDocuments.findIndex(
      (document) => workspace.documentIdentity(document) === identity,
    );
    if (index < 0) return;
    const remaining = workspace.openDocuments.filter(
      (document) => workspace.documentIdentity(document) !== identity,
    );
    const closingActive = workspace.activeIdentity === identity;
    const fallback = closingActive
      ? (workspace.openDocuments[index + 1] ??
        workspace.openDocuments[index - 1] ??
        null)
      : workspace.activeDocument;
    if (!(await workspace.closeDocument(identity))) return;
    const active = fallback
      ? { root: fallback.root, path: fallback.path }
      : null;
    await onSettingsChange((current) => ({
      ...current,
      docsRoot: active?.root ?? null,
      tabSessions: {
        ...current.tabSessions,
        docs: {
          documents: remaining.map(({ root, path }) => ({ root, path })),
          active,
        },
      },
    }));
  };

  const changeSpace = async (space: Space) => {
    if (space === settings.activeSpace) return;
    if (!(await workspace.persistAllOpenDocuments())) return;
    await onSettingsChange((current) => ({ ...current, activeSpace: space }));
  };

  useEffect(() => {
    let closing = false;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    const appWindow = getCurrentWindow();
    void appWindow
      .onCloseRequested(async (event) => {
        event.preventDefault();
        if (closing) return;
        closing = true;
        const closed = await runCloseBarrier(
          workspace.persistAllOpenDocuments,
          () => appWindow.destroy(),
        );
        if (!closed) closing = false;
      })
      .then((stopListening) => {
        if (disposed) stopListening();
        else unlisten = stopListening;
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [workspace.persistAllOpenDocuments]);

  const confirmTrashDocument = async (path: string, origin: HTMLElement) => {
    actionOriginRef.current = origin;
    if (!(await workspace.openDocument(path))) return;
    const approved = await showConfirmation(
      messages.app.confirmTrashDocument(titleFromPath(path)),
      { title: messages.app.trashDocumentTitle, kind: "warning" },
    );
    if (approved) await workspace.removeActive();
    restoreActionFocus();
  };

  const confirmTrashFolder = async (path: string, origin: HTMLElement) => {
    actionOriginRef.current = origin;
    const approved = await showConfirmation(messages.app.confirmTrashFolder, {
      title: messages.app.trashFolderTitle,
      kind: "warning",
    });
    if (approved && (await workspace.persistAllOpenDocuments())) {
      await workspace.removeFolderAt(path);
    }
    restoreActionFocus();
  };

  if (workspace.loading) {
    return (
      <WindowFrame>
        <LoadingScreen />
      </WindowFrame>
    );
  }

  return (
    <WindowFrame documentTitle={workspace.activeDocument?.title}>
      <main
        className={`app-shell ${folderVisible ? "has-folders" : ""} ${settings.listPaneOpen ? "has-list" : "content-only"}`}
        data-space={settings.activeSpace}
      >
        {folderVisible && (
          <aside className="pane folder-pane">
            <div className="space-header">
              <SpaceSwitcher
                activeSpace={settings.activeSpace}
                onChange={changeSpace}
                onRootChange={
                  settings.activeSpace === "intent"
                    ? () => void handleRootChange()
                    : undefined
                }
                root={settings.activeSpace === "intent" ? root : null}
              />
              {settings.activeSpace === "docs" ? (
                <DocsRootSwitcher
                  activeIdentity={workspace.activeIdentity ?? ""}
                  documents={workspace.openDocuments}
                  getIdentity={workspace.documentIdentity}
                  onClose={closeTab}
                  onOpenDocument={() => void openAiDocument()}
                  onSelect={selectTab}
                />
              ) : null}
            </div>
            <header className="pane-header folder-header">
              <strong>{messages.app.folders}</strong>
              {activeSpace === "intent" ? (
                <button
                  className="icon-button"
                  aria-label={createFolderLabel}
                  onClick={() => setDialog("folder")}
                  type="button"
                >
                  <Plus size={15} />
                </button>
              ) : null}
            </header>
            <FolderTree
              folders={workspace.snapshot.folders}
              readOnly={activeSpace === "docs"}
              rootName={rootName}
              onMove={(path, origin) => {
                actionOriginRef.current = origin;
                workspace.setSelectedFolder(path);
                setMoveTarget({ kind: "folder", path });
              }}
              onRename={(path, origin) => {
                actionOriginRef.current = origin;
                workspace.setSelectedFolder(path);
                setDialogTargetPath(path);
                setDialog("rename-folder");
              }}
              onSelect={workspace.setSelectedFolder}
              onTrash={(path, origin) => void confirmTrashFolder(path, origin)}
              selectedPath={workspace.selectedFolder}
            />
            <button
              className="settings-button"
              onClick={(event) => openSettings(event.currentTarget)}
              type="button"
            >
              <Settings aria-hidden="true" size={15} />
              {messages.app.settings}
            </button>
          </aside>
        )}

        {settings.listPaneOpen && (
          <section className="pane list-pane">
            {!folderVisible && (
              <div className="space-header">
                <SpaceSwitcher
                  activeSpace={settings.activeSpace}
                  onChange={changeSpace}
                />
                {settings.activeSpace === "docs" ? (
                  <DocsRootSwitcher
                    activeIdentity={workspace.activeIdentity ?? ""}
                    documents={workspace.openDocuments}
                    getIdentity={workspace.documentIdentity}
                    onClose={closeTab}
                    onOpenDocument={() => void openAiDocument()}
                    onSelect={selectTab}
                  />
                ) : null}
              </div>
            )}
            <header className="pane-header">
              <div>
                <strong>
                  {workspace.selectedFolder === ""
                    ? rootName
                    : folderLabel(workspace.selectedFolder)}
                </strong>
                <span>
                  {messages.app.notes(workspace.visibleDocuments.length)}
                </span>
              </div>
              <div className="pane-actions">
                <button
                  className="icon-button"
                  aria-label={messages.app.refreshList}
                  onClick={() => void workspace.refresh()}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={
                    settings.documentSort === "updated"
                      ? messages.app.sortLatest
                      : messages.app.sortTitle
                  }
                  onClick={() =>
                    updateLayout({
                      documentSort:
                        settings.documentSort === "updated"
                          ? "title"
                          : "updated",
                    })
                  }
                  type="button"
                >
                  {settings.documentSort === "updated" ? (
                    <ArrowDownWideNarrow aria-hidden="true" size={15} />
                  ) : (
                    <ArrowDownAZ aria-hidden="true" size={15} />
                  )}
                </button>
                <button
                  aria-label={densityLabels[settings.documentDensity]}
                  className="icon-button"
                  data-density={settings.documentDensity}
                  onClick={() =>
                    updateLayout({ documentDensity: densityControl.next })
                  }
                  type="button"
                >
                  <DensityIcon aria-hidden="true" size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={
                    activeSpace === "docs"
                      ? messages.app.chooseDocsRoot
                      : createDocumentLabel
                  }
                  onClick={() =>
                    activeSpace === "docs"
                      ? void openAiDocument()
                      : setDialog("document")
                  }
                  type="button"
                >
                  <Plus aria-hidden="true" size={15} />
                </button>
              </div>
            </header>
            <DocumentList
              density={settings.documentDensity}
              documents={sortedDocuments}
              readOnly={activeSpace === "docs"}
              snippets={workspace.visibleSnippets}
              onMove={(path, origin) => {
                actionOriginRef.current = origin;
                void workspace.openDocument(path).then((opened) => {
                  if (opened) setMoveTarget({ kind: "document", path });
                });
              }}
              onRename={(path, origin) => {
                actionOriginRef.current = origin;
                void workspace.openDocument(path).then((opened) => {
                  if (opened) setDialog("rename-document");
                });
              }}
              onSelect={(path) => void workspace.openDocument(path)}
              onTrash={(path, origin) =>
                void confirmTrashDocument(path, origin)
              }
              selectedPath={workspace.activePath}
            />
            {!folderVisible && (
              <button
                className="settings-button"
                onClick={(event) => openSettings(event.currentTarget)}
                type="button"
              >
                <Settings aria-hidden="true" size={15} />
                {messages.app.settings}
              </button>
            )}
          </section>
        )}

        <section className="content-pane">
          <TabBar
            activePath={
              activeSpace === "docs"
                ? workspace.activeIdentity
                : workspace.activePath
            }
            docsMode={activeSpace === "docs"}
            documents={workspace.openDocuments}
            getDocumentIdentity={
              activeSpace === "docs" ? workspace.documentIdentity : undefined
            }
            leadingAction={
              <button
                aria-label={layoutControl.label}
                className="icon-button header-cycle-button layout-cycle-button"
                data-layout={layoutControl.state}
                onClick={() => updateLayout(nextPaneLayout(settings))}
                title={layoutControl.label}
                type="button"
              >
                <PanelLeft aria-hidden="true" size={16} />
              </button>
            }
            onClose={closeTab}
            onSelect={(identity) => void selectTab(identity)}
            trailingActions={
              workspace.activeDocument ? (
                <>
                  <button
                    aria-label={messages.app.reloadCurrentDocument}
                    className="icon-button current-document-reload"
                    disabled={
                      workspace.saveStatus === "saving" ||
                      workspace.reloadingCurrentDocument
                    }
                    onClick={() => void workspace.reloadCurrentDocument()}
                    title={messages.app.reloadCurrentDocument}
                    type="button"
                  >
                    <RefreshCw aria-hidden="true" size={15} />
                  </button>
                  {activeSpace === "intent" &&
                  (workspace.saveStatus === "dirty" ||
                    workspace.saveStatus === "saving" ||
                    workspace.saveStatus === "error") ? (
                    <span className={`save-status ${workspace.saveStatus}`}>
                      {saveLabel(workspace.saveStatus, messages)}
                    </span>
                  ) : null}
                  {activeSpace === "intent" && modeControl ? (
                    <button
                      aria-label={modeControl.label}
                      className="icon-button header-cycle-button mode-cycle-button"
                      data-mode={workspace.activeDocument.mode}
                      onClick={() => workspace.setMode(modeControl.next)}
                      title={modeControl.label}
                      type="button"
                    >
                      <ModeIcon aria-hidden="true" size={16} />
                    </button>
                  ) : null}
                </>
              ) : null
            }
          />

          {(documentSourceError ?? workspace.errorMessage) && (
            <div className="inline-notice" role="alert">
              <span>{documentSourceError ?? workspace.errorMessage}</span>
              <button
                className="icon-button"
                aria-label={messages.app.closeError}
                onClick={
                  documentSourceError
                    ? () => setDocumentSourceError(null)
                    : workspace.clearError
                }
                type="button"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {workspace.activeDocument ? (
            <div
              className={`document-surface ${workspace.activeDocument.mode === "split" ? "is-split" : ""}`}
              data-mode={workspace.activeDocument.mode}
            >
              <div
                className={`editor-surface ${workspace.activeDocument.mode === "view" ? "is-hidden" : ""}`}
              >
                <MarkdownEditor
                  documentKey={workspace.activeDocument.path}
                  onChange={workspace.updateBody}
                  openDocumentKeys={workspace.openDocuments.map(
                    (document) => document.path,
                  )}
                  value={workspace.activeDocument.body}
                  visible={workspace.activeDocument.mode !== "view"}
                />
              </div>
              {workspace.activeDocument.mode !== "edit" && (
                <MarkdownView body={workspace.activeDocument.body} />
              )}
            </div>
          ) : (
            <div className="content-empty">
              {settings.activeSpace === "intent" ? (
                <p>
                  {messages.app.intentEmptyLead}
                  <br />
                  {messages.app.intentEmptyTail}
                </p>
              ) : (
                <p>
                  {messages.app.docsEmptyLead}
                  <br />
                  {messages.app.docsEmptyTail}
                </p>
              )}
              <button
                className="primary-button"
                onClick={() =>
                  activeSpace === "docs"
                    ? void openAiDocument()
                    : setDialog("document")
                }
                type="button"
              >
                {activeSpace === "docs"
                  ? messages.app.chooseDocsRoot
                  : createDocumentLabel}
              </button>
            </div>
          )}
        </section>

        <NameDialog
          initialValue={
            dialog === "rename-document"
              ? workspace.activeDocument?.title
              : dialog === "rename-folder"
                ? folderLabel(dialogTargetPath ?? "")
                : ""
          }
          label={
            dialog === "document"
              ? createDocumentFieldLabel
              : dialog === "folder"
                ? createFolderFieldLabel
                : dialog === "rename-document"
                  ? messages.dialogs.documentName
                  : messages.dialogs.folderName
          }
          onCancel={closeActionDialog}
          onSubmit={async (value) => {
            if (dialog === "document") await workspace.addDocument(value);
            if (dialog === "folder") await workspace.addFolder(value);
            if (dialog === "rename-document")
              await workspace.renameActive(value);
            if (dialog === "rename-folder" && dialogTargetPath)
              await workspace.renameFolderAt(dialogTargetPath, value);
            closeActionDialog();
          }}
          open={dialog !== null}
          submitLabel={
            dialog === "rename-document" || dialog === "rename-folder"
              ? messages.dialogs.rename
              : messages.dialogs.create
          }
          title={
            dialog === "document"
              ? createDocumentLabel
              : dialog === "rename-document"
                ? messages.dialogs.renameDocument
                : dialog === "rename-folder"
                  ? messages.dialogs.renameFolder
                  : createFolderLabel
          }
        />
        <MoveDialog
          destinations={moveDestinations}
          onCancel={closeActionDialog}
          onSubmit={async (destination) => {
            if (moveTarget?.kind === "document") {
              await workspace.moveActive(destination);
            }
            if (moveTarget?.kind === "folder") {
              await workspace.moveFolderAt(moveTarget.path, destination);
            }
            closeActionDialog();
          }}
          open={moveTarget !== null}
          title={
            moveTarget?.kind === "folder"
              ? messages.dialogs.moveFolder
              : messages.dialogs.moveDocument
          }
        />
        <SettingsDialog
          language={settings.language}
          onClose={closeSettings}
          onLanguageChange={(language) => updateLayout({ language })}
          onThemeChange={(theme) => updateLayout({ theme })}
          onWritingFontChange={(writingFont) => updateLayout({ writingFont })}
          open={settingsOpen}
          theme={settings.theme}
          writingFont={settings.writingFont}
        />
      </main>
    </WindowFrame>
  );
}

async function chooseLibrary(title: string): Promise<string | null> {
  const selected = await open({
    title,
    directory: true,
    multiple: false,
  });
  return typeof selected === "string" ? selected : null;
}

async function chooseDocument(title: string): Promise<string | null> {
  const selected = await open({
    title,
    directory: false,
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  return typeof selected === "string" ? selected : null;
}

function appendDocumentReference(
  references: readonly DocsDocumentRef[],
  reference: DocsDocumentRef,
): readonly DocsDocumentRef[] {
  return references.some((candidate) => sameDocumentRef(candidate, reference))
    ? references
    : [...references, reference];
}

function folderLabel(path: string): string {
  return path.split("/").at(-1) ?? path;
}

function parentPath(path: string): string {
  return path.split("/").slice(0, -1).join("/");
}

function titleFromPath(path: string): string {
  const name = path.split("/").at(-1) ?? path;
  return name.endsWith(".md") ? name.slice(0, -3) : name;
}

function saveLabel(
  status: ReturnType<typeof useLibraryWorkspace>["saveStatus"],
  messages: Messages,
): string {
  if (status === "dirty") return messages.save.dirty;
  if (status === "saving") return messages.save.saving;
  if (status === "saved") return messages.save.saved;
  if (status === "error") return messages.save.error;
  return "";
}

function sameSession(left: TabSession, right: TabSession): boolean {
  return (
    left.activePath === right.activePath &&
    left.paths.length === right.paths.length &&
    left.paths.every((path, index) => path === right.paths[index])
  );
}

function sameDocsSession(left: DocsTabSession, right: DocsTabSession): boolean {
  return (
    sameDocumentRef(left.active, right.active) &&
    left.documents.length === right.documents.length &&
    left.documents.every((reference, index) =>
      sameDocumentRef(reference, right.documents[index] ?? null),
    )
  );
}

function sameDocumentRef(
  left: DocsDocumentRef | null,
  right: DocsDocumentRef | null,
): boolean {
  return left?.root === right?.root && left?.path === right?.path;
}
