import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, confirm as showConfirmation } from "@tauri-apps/plugin-dialog";
import type { LucideIcon } from "lucide-react";
import {
  Columns2,
  Eye,
  PanelLeft,
  PencilLine,
  Plus,
  Settings,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DocumentList } from "@/components/DocumentList";
import { FolderTree } from "@/components/FolderTree";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownView } from "@/components/MarkdownView";
import { MoveDialog } from "@/components/MoveDialog";
import { NameDialog } from "@/components/NameDialog";
import { PrimitiveShowcase } from "@/components/PrimitiveShowcase";
import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { TabBar } from "@/components/TabBar";
import {
  runCloseBarrier,
  useLibraryWorkspace,
} from "@/hooks/useLibraryWorkspace";
import { getMessages, I18nProvider, type Messages, useI18n } from "@/lib/i18n";
import { formatRootDisplay } from "@/lib/rootDisplay";
import { loadSettings, nextPaneLayout, saveSettings } from "@/lib/settings";
import { applyResolvedTheme, resolveTheme } from "@/lib/theme";
import type {
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

type SettingsUpdater = (current: LayoutSettings) => LayoutSettings;
type SettingsChange = (update: SettingsUpdater) => Promise<void>;

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

  const root =
    settings.activeSpace === "intent"
      ? settings.libraryRoot
      : settings.docsRoot;

  if (!root && settings.activeSpace === "intent") {
    return (
      <WindowFrame>
        <WelcomeScreen
          onChoose={async () => {
            const root = await chooseLibrary(messages.app.chooseIntentRoot);
            if (!root) return;
            await onSettingsChange((current) => ({
              ...current,
              libraryRoot: root,
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

  if (!root) {
    return (
      <WindowFrame>
        <DocsWelcomeScreen
          onChoose={async () => {
            const root = await chooseLibrary(messages.app.chooseDocsRoot);
            if (!root) return;
            await onSettingsChange((current) => ({
              ...current,
              docsRoot: root,
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
      key={`${settings.activeSpace}:${root}`}
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

type WelcomeScreenProps = {
  readonly onChoose: () => Promise<void>;
  readonly onSpaceChange: (space: Space) => Promise<void>;
};

function WelcomeScreen({ onChoose, onSpaceChange }: WelcomeScreenProps) {
  const messages = useI18n();
  return (
    <main className="welcome-screen" data-space="intent">
      <div className="welcome-switcher">
        <SpaceSwitcher activeSpace="intent" onChange={onSpaceChange} />
      </div>
      <p className="eyebrow">{messages.app.welcomeEyebrow}</p>
      <h1>{messages.app.welcomeTitle}</h1>
      <p>{messages.app.welcomeBody}</p>
      <button
        className="primary-button welcome-action"
        onClick={() => void onChoose()}
        type="button"
      >
        {messages.app.chooseIntentRoot}
      </button>
    </main>
  );
}

type DocsWelcomeScreenProps = {
  readonly onChoose: () => Promise<void>;
  readonly onSpaceChange: (space: Space) => Promise<void>;
};

function DocsWelcomeScreen({
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
    (session: TabSession) => {
      void onSettingsChange((current) => {
        if (sameSession(current.tabSessions[activeSpace], session)) {
          return current;
        }
        return {
          ...current,
          tabSessions: {
            ...current.tabSessions,
            [activeSpace]: session,
          },
        };
      });
    },
    [activeSpace, onSettingsChange],
  );
  const workspace = useLibraryWorkspace(root, {
    defaultMode,
    initialSession: settings.tabSessions[settings.activeSpace],
    onSessionChange: persistTabSession,
  });
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [dialogTargetPath, setDialogTargetPath] = useState<string | null>(null);
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

  const handleRootChange = async (space: Space) => {
    if (!(await workspace.persistAllOpenDocuments())) return;
    const nextRoot = await chooseLibrary(
      space === "intent"
        ? messages.app.chooseIntentRoot
        : messages.app.chooseDocsRoot,
    );
    if (!nextRoot) return;
    await onSettingsChange((current) =>
      space === "intent"
        ? { ...current, libraryRoot: nextRoot }
        : { ...current, docsRoot: nextRoot },
    );
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
                onRootChange={() => void handleRootChange(settings.activeSpace)}
                root={root}
              />
            </div>
            <header className="pane-header folder-header">
              <strong>{messages.app.folders}</strong>
              <button
                className="icon-button"
                aria-label={createFolderLabel}
                onClick={() => setDialog("folder")}
                type="button"
              >
                <Plus size={15} />
              </button>
            </header>
            <FolderTree
              folders={workspace.snapshot.folders}
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
              <button
                className="icon-button"
                aria-label={createDocumentLabel}
                onClick={() => setDialog("document")}
                type="button"
              >
                <Plus size={15} />
              </button>
            </header>
            <DocumentList
              documents={workspace.visibleDocuments}
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
            activePath={workspace.activePath}
            documents={workspace.openDocuments}
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
            onClose={async (path) => {
              await workspace.closeDocument(path);
            }}
            onSelect={workspace.setActiveDocument}
            trailingActions={
              modeControl ? (
                <>
                  {workspace.saveStatus === "dirty" ||
                  workspace.saveStatus === "saving" ||
                  workspace.saveStatus === "error" ? (
                    <span className={`save-status ${workspace.saveStatus}`}>
                      {saveLabel(workspace.saveStatus, messages)}
                    </span>
                  ) : null}
                  <button
                    aria-label={modeControl.label}
                    className="icon-button header-cycle-button mode-cycle-button"
                    data-mode={workspace.activeDocument?.mode}
                    onClick={() => workspace.setMode(modeControl.next)}
                    title={modeControl.label}
                    type="button"
                  >
                    <ModeIcon aria-hidden="true" size={16} />
                  </button>
                </>
              ) : null
            }
          />

          {workspace.errorMessage && (
            <div className="inline-notice" role="alert">
              <span>{workspace.errorMessage}</span>
              <button
                className="icon-button"
                aria-label={messages.app.closeError}
                onClick={workspace.clearError}
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
                onClick={() => setDialog("document")}
                type="button"
              >
                {createDocumentLabel}
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
