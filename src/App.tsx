import { getCurrentWindow } from "@tauri-apps/api/window";
import { open, confirm as showConfirmation } from "@tauri-apps/plugin-dialog";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownAZ,
  ArrowDownWideNarrow,
  ChevronDown,
  ChevronUp,
  Columns2,
  Eye,
  FileDown,
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
import { FileExplorerTree } from "@/components/FileExplorerTree";
import { FolderTree } from "@/components/FolderTree";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { MarkdownView } from "@/components/MarkdownView";
import { MoveDialog } from "@/components/MoveDialog";
import { NameDialog } from "@/components/NameDialog";
import { OnboardingScreen } from "@/components/OnboardingScreen";
import { PinnedRootsSwitcher } from "@/components/PinnedRootsSwitcher";
import { PrimitiveShowcase } from "@/components/PrimitiveShowcase";
import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { TabBar } from "@/components/TabBar";
import {
  runCloseBarrier,
  useLibraryWorkspace,
} from "@/hooks/useLibraryWorkspace";
import {
  suggestDocsFolderLabel,
  validateDocsFolderLabel,
} from "@/lib/docsFolderLabel";
import { getMessages, I18nProvider, type Messages, useI18n } from "@/lib/i18n";
import { printDocument, resolveLibraryRoot, scanDocsRoot } from "@/lib/native";
import { formatRootDisplay } from "@/lib/rootDisplay";
import { loadSettings, nextPaneLayout, saveSettings } from "@/lib/settings";
import { findLiteralMatches } from "@/lib/textSearch";
import {
  applyResolvedTheme,
  applySpacePalette,
  resolveTheme,
} from "@/lib/theme";
import type {
  DocsPinnedRoot,
  DocsSourceMode,
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

type PinnedNavigationState = {
  readonly selectedFolder: string;
  readonly expandedPaths: ReadonlySet<string>;
};

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

type DocumentFindBarProps = {
  readonly activeIndex: number;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly matches: number;
  readonly messages: Messages["app"];
  readonly onClose: () => void;
  readonly onMove: (direction: -1 | 1) => void;
  readonly onQueryChange: (query: string) => void;
  readonly query: string;
};

function DocumentFindBar({
  activeIndex,
  inputRef,
  matches,
  messages,
  onClose,
  onMove,
  onQueryChange,
  query,
}: DocumentFindBarProps) {
  return (
    <form
      className="document-find-bar"
      onSubmit={(event) => event.preventDefault()}
    >
      <input
        aria-label={messages.findCurrentDocument}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          } else if (event.key === "Enter") {
            event.preventDefault();
            onMove(event.shiftKey ? -1 : 1);
          }
        }}
        placeholder={messages.findPlaceholder}
        ref={inputRef}
        type="search"
        value={query}
      />
      <output aria-live="polite" className="document-find-status">
        {matches > 0 ? activeIndex + 1 : 0}/{matches}
      </output>
      <button
        aria-label={messages.findPrevious}
        className="icon-button"
        disabled={matches === 0}
        onClick={() => onMove(-1)}
        title={messages.findPrevious}
        type="button"
      >
        <ChevronUp aria-hidden="true" size={14} />
      </button>
      <button
        aria-label={messages.findNext}
        className="icon-button"
        disabled={matches === 0}
        onClick={() => onMove(1)}
        title={messages.findNext}
        type="button"
      >
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      <button
        aria-label={messages.closeFind}
        className="icon-button"
        onClick={onClose}
        title={messages.closeFind}
        type="button"
      >
        <X aria-hidden="true" size={14} />
      </button>
    </form>
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
  const spacePalette = settings?.spacePalette ?? "classic";
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
    applySpacePalette(spacePalette);
  }, [spacePalette]);

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
  const [pendingPinnedRoot, setPendingPinnedRoot] = useState<string | null>(
    null,
  );
  const pinnedNavigationRef = useRef(new Map<string, PinnedNavigationState>());

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
          spacePalette={settings.spacePalette}
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
          onSpacePaletteChange={(spacePalette) => {
            void onSettingsChange((current) => ({
              ...current,
              spacePalette,
            }));
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
      : settings.docsSourceMode === "browse"
        ? settings.docsBrowseRoot
        : settings.docsPinnedRoot;

  if (!root) {
    const chooseDocsFolder = async () => {
      const selected = await chooseLibrary(
        settings.docsSourceMode === "browse"
          ? messages.app.chooseDocsRoot
          : messages.pinnedRoots.pinFolder,
      );
      if (!selected) return;
      try {
        const canonicalRoot = await resolveLibraryRoot(selected);
        if (settings.docsSourceMode === "browse") {
          setDocumentSourceError(null);
          await onSettingsChange((current) => ({
            ...current,
            docsBrowseRoots: current.docsBrowseRoots.includes(canonicalRoot)
              ? current.docsBrowseRoots
              : [...current.docsBrowseRoots, canonicalRoot],
            docsBrowseRoot: canonicalRoot,
            tabSessions: {
              ...current.tabSessions,
              docsBrowse: {
                ...current.tabSessions.docsBrowse,
                [canonicalRoot]: current.tabSessions.docsBrowse[
                  canonicalRoot
                ] ?? {
                  paths: [],
                  activePath: null,
                },
              },
            },
          }));
          return;
        }
        const exact = settings.docsPinnedRoots.find(
          ({ root: pinnedRoot }) => pinnedRoot === canonicalRoot,
        );
        if (exact) {
          await onSettingsChange((current) => ({
            ...current,
            docsPinnedRoot: canonicalRoot,
          }));
          return;
        }
        if (
          settings.docsPinnedRoots.some(({ root: pinnedRoot }) =>
            pathsOverlap(pinnedRoot, canonicalRoot),
          )
        ) {
          setDocumentSourceError(messages.pinnedRoots.overlap);
          return;
        }
        setDocumentSourceError(null);
        setPendingPinnedRoot(canonicalRoot);
      } catch (cause) {
        setDocumentSourceError(messageFromUnknown(cause));
      }
    };
    return (
      <>
        <WindowFrame>
          <DocsWelcomeScreen
            errorMessage={documentSourceError}
            onClearError={() => setDocumentSourceError(null)}
            onChoose={chooseDocsFolder}
            onModeChange={async (mode) => {
              await onSettingsChange((current) => ({
                ...current,
                docsSourceMode: mode,
              }));
            }}
            onSpaceChange={async (space) => {
              await onSettingsChange((current) => ({
                ...current,
                activeSpace: space,
              }));
            }}
            sourceMode={settings.docsSourceMode}
          />
        </WindowFrame>
        <NameDialog
          initialValue={
            pendingPinnedRoot ? suggestDocsFolderLabel(pendingPinnedRoot) : ""
          }
          label={messages.pinnedRoots.labelField}
          onCancel={() => setPendingPinnedRoot(null)}
          onSubmit={async (label) => {
            if (!pendingPinnedRoot) return;
            await onSettingsChange((current) => ({
              ...current,
              docsPinnedRoots: [
                ...current.docsPinnedRoots,
                { root: pendingPinnedRoot, label },
              ],
              docsPinnedRoot: pendingPinnedRoot,
            }));
            setPendingPinnedRoot(null);
          }}
          open={pendingPinnedRoot !== null}
          submitLabel={messages.pinnedRoots.saveLabel}
          title={messages.pinnedRoots.labelTitle}
          validate={validateDocsFolderLabel}
          validationMessage={messages.pinnedRoots.labelInvalid}
        />
      </>
    );
  }

  return (
    <LibraryApp
      key={
        settings.activeSpace === "intent"
          ? `intent:${root}`
          : `docs:${settings.docsSourceMode}:${root}`
      }
      onSettingsChange={onSettingsChange}
      pinnedNavigation={pinnedNavigationRef.current}
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
  readonly onModeChange: (mode: DocsSourceMode) => Promise<void>;
  readonly onSpaceChange: (space: Space) => Promise<void>;
  readonly sourceMode: DocsSourceMode;
};

function DocsWelcomeScreen({
  errorMessage,
  onClearError,
  onChoose,
  onModeChange,
  onSpaceChange,
  sourceMode,
}: DocsWelcomeScreenProps) {
  const messages = useI18n();
  const guidanceBody =
    sourceMode === "browse"
      ? messages.app.docsBody
      : messages.pinnedRoots.emptyBody;
  return (
    <main className="docs-welcome-screen" data-space="docs">
      <div className="welcome-switcher">
        <SpaceSwitcher activeSpace="docs" onChange={onSpaceChange} />
      </div>
      <div className="docs-welcome-copy">
        <fieldset className="docs-source-mode-choice">
          <legend>{messages.docsSourceModes.selectorLabel}</legend>
          {(["browse", "pinned"] as const).map((mode) => (
            <button
              aria-pressed={sourceMode === mode}
              className={sourceMode === mode ? "active" : undefined}
              key={mode}
              onClick={() => void onModeChange(mode)}
              type="button"
            >
              {messages.docsSourceModes[mode]}
            </button>
          ))}
        </fieldset>
        <p className="eyebrow">{messages.app.docsEyebrow}</p>
        <h1>
          {sourceMode === "browse"
            ? messages.app.docsTitle
            : messages.pinnedRoots.emptyTitle}
        </h1>
        {guidanceBody ? <p>{guidanceBody}</p> : null}
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
          {sourceMode === "browse"
            ? messages.app.chooseDocsRoot
            : messages.pinnedRoots.pinFolder}
        </button>
      </div>
    </main>
  );
}

type DocsSourceModeSelectProps = {
  readonly onChange: (mode: DocsSourceMode) => Promise<void>;
  readonly value: DocsSourceMode;
};

function DocsSourceModeSelect({ onChange, value }: DocsSourceModeSelectProps) {
  const messages = useI18n();
  return (
    <select
      aria-label={messages.docsSourceModes.selectorLabel}
      className="docs-source-mode-select"
      onChange={(event) => {
        void onChange(docsSourceModeFromValue(event.currentTarget.value));
      }}
      value={value}
    >
      <option value="browse">{messages.docsSourceModes.browse}</option>
      <option value="pinned">{messages.docsSourceModes.pinned}</option>
    </select>
  );
}

type LibraryAppProps = {
  readonly root: string;
  readonly settings: LayoutSettings;
  readonly onSettingsChange: SettingsChange;
  readonly pinnedNavigation: Map<string, PinnedNavigationState>;
};

function LibraryApp({
  root,
  settings,
  onSettingsChange,
  pinnedNavigation,
}: LibraryAppProps) {
  const messages = useI18n();
  const rootName = formatRootDisplay(root).leaf;
  const defaultMode = settings.activeSpace === "docs" ? "view" : "edit";
  const activeSpace = settings.activeSpace;
  const aiMode = activeSpace === "docs";
  const pinnedMode = aiMode && settings.docsSourceMode === "pinned";
  const browseMode = aiMode && settings.docsSourceMode === "browse";
  const initialNavigation = pinnedNavigation.get(root) ?? {
    selectedFolder: "",
    expandedPaths: new Set<string>(),
  };
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(
    initialNavigation.expandedPaths,
  );
  const persistTabSession = useCallback(
    (session: TabSession) => {
      void onSettingsChange((current) => {
        const previous =
          activeSpace === "intent"
            ? current.tabSessions.intent
            : browseMode
              ? (current.tabSessions.docsBrowse[root] ?? {
                  paths: [],
                  activePath: null,
                })
              : (current.tabSessions.docsPinned[root] ?? {
                  paths: [],
                  activePath: null,
                });
        if (sameSession(previous, session)) {
          return current;
        }
        return {
          ...current,
          tabSessions: {
            ...current.tabSessions,
            ...(activeSpace === "intent"
              ? { intent: session }
              : browseMode
                ? {
                    docsBrowse: {
                      ...current.tabSessions.docsBrowse,
                      [root]: session,
                    },
                  }
                : {
                    docsPinned: {
                      ...current.tabSessions.docsPinned,
                      [root]: session,
                    },
                  }),
          },
        };
      });
    },
    [activeSpace, browseMode, onSettingsChange, root],
  );
  const workspace = useLibraryWorkspace(root, {
    defaultMode,
    initialSession:
      activeSpace === "intent"
        ? settings.tabSessions.intent
        : pinnedMode
          ? (settings.tabSessions.docsPinned[root] ?? {
              paths: [],
              activePath: null,
            })
          : (settings.tabSessions.docsBrowse[root] ?? {
              paths: [],
              activePath: null,
            }),
    initialSelectedFolder: aiMode
      ? initialNavigation.selectedFolder
      : undefined,
    onSelectedFolderChange: aiMode
      ? (selectedFolder) => {
          const previous = pinnedNavigation.get(root) ?? initialNavigation;
          pinnedNavigation.set(root, { ...previous, selectedFolder });
        }
      : undefined,
    onSessionChange: persistTabSession,
    scan: aiMode ? scanDocsRoot : undefined,
  });
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [labelTarget, setLabelTarget] = useState<DocsPinnedRoot | null>(null);
  const [dialogTargetPath, setDialogTargetPath] = useState<string | null>(null);
  const [documentSourceError, setDocumentSourceError] = useState<string | null>(
    null,
  );
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findActiveResult, setFindActiveResult] = useState(0);
  const actionOriginRef = useRef<HTMLElement | null>(null);
  const settingsOriginRef = useRef<HTMLButtonElement | null>(null);
  const findOriginRef = useRef<HTMLElement | null>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const findMatches = useMemo(
    () => findLiteralMatches(workspace.activeDocument?.body ?? "", findQuery),
    [findQuery, workspace.activeDocument?.body],
  );
  const normalizedFindIndex =
    findMatches.length > 0
      ? ((findActiveResult % findMatches.length) + findMatches.length) %
        findMatches.length
      : 0;
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
  const workspaceErrorMessage =
    pinnedMode && workspace.rootUnavailable
      ? messages.pinnedRoots.missing
      : workspace.errorMessage;

  const updateLayout = useCallback(
    (partial: Partial<LayoutSettings>) => {
      void onSettingsChange((current) => ({ ...current, ...partial }));
    },
    [onSettingsChange],
  );

  const transitionAfterSave = async (
    update: SettingsUpdater,
  ): Promise<boolean> => {
    if (!(await workspace.persistAllOpenDocuments())) return false;
    await onSettingsChange(update);
    return true;
  };

  const changeDocsSourceMode = async (mode: DocsSourceMode): Promise<void> => {
    if (mode === settings.docsSourceMode) return;
    await transitionAfterSave((current) => ({
      ...current,
      docsSourceMode: mode,
    }));
  };

  const pinFolder = async (): Promise<void> => {
    const selected = await chooseLibrary(messages.pinnedRoots.pinFolder);
    if (!selected) return;
    try {
      const canonicalRoot = await resolveLibraryRoot(selected);
      const exact = settings.docsPinnedRoots.find(
        ({ root: pinnedRoot }) => pinnedRoot === canonicalRoot,
      );
      if (exact) {
        await transitionAfterSave((current) => ({
          ...current,
          docsPinnedRoot: canonicalRoot,
        }));
        return;
      }
      if (
        settings.docsPinnedRoots.some(({ root: pinnedRoot }) =>
          pathsOverlap(pinnedRoot, canonicalRoot),
        )
      ) {
        setDocumentSourceError(messages.pinnedRoots.overlap);
        return;
      }
      setDocumentSourceError(null);
      setLabelTarget({
        root: canonicalRoot,
        label: suggestDocsFolderLabel(canonicalRoot),
      });
    } catch (cause) {
      setDocumentSourceError(messageFromUnknown(cause));
    }
  };

  const openBrowseFolder = async (): Promise<void> => {
    const selected = await chooseLibrary(messages.app.chooseDocsRoot);
    if (!selected) return;
    try {
      const canonicalRoot = await resolveLibraryRoot(selected);
      setDocumentSourceError(null);
      await transitionAfterSave((current) => ({
        ...current,
        docsBrowseRoots: current.docsBrowseRoots.includes(canonicalRoot)
          ? current.docsBrowseRoots
          : [...current.docsBrowseRoots, canonicalRoot],
        docsBrowseRoot: canonicalRoot,
        tabSessions: {
          ...current.tabSessions,
          docsBrowse: {
            ...current.tabSessions.docsBrowse,
            [canonicalRoot]: current.tabSessions.docsBrowse[canonicalRoot] ?? {
              paths: [],
              activePath: null,
            },
          },
        },
      }));
    } catch (cause) {
      setDocumentSourceError(messageFromUnknown(cause));
    }
  };

  const selectBrowseRoot = async (nextRoot: string): Promise<boolean> => {
    if (nextRoot === root) return true;
    return transitionAfterSave((current) => ({
      ...current,
      docsBrowseRoot: nextRoot,
    }));
  };

  const closeBrowseRoot = async (removedRoot: string): Promise<boolean> =>
    transitionAfterSave((current) => {
      const removedIndex = current.docsBrowseRoots.indexOf(removedRoot);
      const docsBrowseRoots = current.docsBrowseRoots.filter(
        (browseRoot) => browseRoot !== removedRoot,
      );
      const docsBrowse = { ...current.tabSessions.docsBrowse };
      delete docsBrowse[removedRoot];
      const fallbackIndex = Math.min(
        Math.max(removedIndex, 0),
        docsBrowseRoots.length - 1,
      );
      return {
        ...current,
        docsBrowseRoots,
        docsBrowseRoot:
          removedRoot === current.docsBrowseRoot
            ? (docsBrowseRoots[fallbackIndex] ?? null)
            : current.docsBrowseRoot,
        tabSessions: { ...current.tabSessions, docsBrowse },
      };
    });

  const savePinnedLabel = async (label: string): Promise<void> => {
    if (!labelTarget) return;
    const nextRoot = labelTarget.root;
    const changed = await transitionAfterSave((current) => {
      const exists = current.docsPinnedRoots.some(
        ({ root: pinnedRoot }) => pinnedRoot === nextRoot,
      );
      return {
        ...current,
        docsPinnedRoots: exists
          ? current.docsPinnedRoots.map((entry) =>
              entry.root === nextRoot ? { ...entry, label } : entry,
            )
          : [...current.docsPinnedRoots, { root: nextRoot, label }],
        docsPinnedRoot: nextRoot,
      };
    });
    if (changed) setLabelTarget(null);
  };

  const selectPinnedRoot = async (nextRoot: string): Promise<boolean> => {
    if (nextRoot === root) return true;
    return transitionAfterSave((current) => ({
      ...current,
      docsPinnedRoot: nextRoot,
    }));
  };

  const unpinRoot = async (removedRoot: string): Promise<boolean> => {
    const session = settings.tabSessions.docsPinned[removedRoot] ?? {
      paths: [],
      activePath: null,
    };
    if (session.paths.length > 0) {
      const approved = await showConfirmation(
        messages.pinnedRoots.confirmUnpin(removedRoot, session.paths.length),
        { title: messages.pinnedRoots.pinFolder, kind: "warning" },
      );
      if (!approved) return false;
    }
    return transitionAfterSave((current) => {
      const removedIndex = current.docsPinnedRoots.findIndex(
        ({ root: pinnedRoot }) => pinnedRoot === removedRoot,
      );
      const docsPinnedRoots = current.docsPinnedRoots.filter(
        ({ root: pinnedRoot }) => pinnedRoot !== removedRoot,
      );
      const docsPinned = { ...current.tabSessions.docsPinned };
      delete docsPinned[removedRoot];
      const fallbackIndex = Math.min(
        Math.max(removedIndex, 0),
        docsPinnedRoots.length - 1,
      );
      return {
        ...current,
        docsPinnedRoots,
        docsPinnedRoot:
          removedRoot === current.docsPinnedRoot
            ? (docsPinnedRoots[fallbackIndex]?.root ?? null)
            : current.docsPinnedRoot,
        tabSessions: {
          ...current.tabSessions,
          docsPinned,
        },
      };
    });
  };

  const toggleExpandedFolder = (path: string) => {
    const next = new Set(expandedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    const previous = pinnedNavigation.get(root) ?? initialNavigation;
    pinnedNavigation.set(root, { ...previous, expandedPaths: next });
    setExpandedPaths(next);
  };

  const docsSourceModeControl =
    activeSpace === "docs" ? (
      <DocsSourceModeSelect
        onChange={changeDocsSourceMode}
        value={settings.docsSourceMode}
      />
    ) : null;
  const pinnedRootEntry = settings.docsPinnedRoots.find(
    ({ root: pinnedRoot }) => pinnedRoot === root,
  );
  const docsSourceCard = browseMode ? (
    <DocsRootSwitcher
      activeRoot={root}
      leadingControl={docsSourceModeControl}
      onClose={closeBrowseRoot}
      onOpenFolder={() => void openBrowseFolder()}
      onSelect={selectBrowseRoot}
      roots={settings.docsBrowseRoots}
    />
  ) : pinnedMode ? (
    <PinnedRootsSwitcher
      activeRoot={root}
      leadingControl={docsSourceModeControl}
      onEditLabel={(targetRoot) => {
        const entry = settings.docsPinnedRoots.find(
          ({ root: pinnedRoot }) => pinnedRoot === targetRoot,
        );
        if (entry) setLabelTarget(entry);
      }}
      onPin={() => void pinFolder()}
      onSelect={selectPinnedRoot}
      onUnpin={unpinRoot}
      roots={settings.docsPinnedRoots}
    />
  ) : null;

  const openDocumentFind = useCallback(() => {
    if (!workspace.activeDocument) return;
    if (!findOpen && document.activeElement instanceof HTMLElement) {
      findOriginRef.current = document.activeElement;
    }
    setFindOpen(true);
    if (findInputRef.current) {
      findInputRef.current.focus();
      findInputRef.current.select();
    }
  }, [findOpen, workspace.activeDocument]);

  const closeDocumentFind = useCallback(() => {
    setFindOpen(false);
    queueMicrotask(() => findOriginRef.current?.focus());
  }, []);

  const moveDocumentFind = useCallback(
    (direction: -1 | 1) => {
      if (findMatches.length === 0) return;
      setFindActiveResult(normalizedFindIndex + direction);
    },
    [findMatches.length, normalizedFindIndex],
  );

  useEffect(() => {
    if (!findOpen) return;
    findInputRef.current?.focus();
    findInputRef.current?.select();
  }, [findOpen]);

  useEffect(() => {
    if (workspace.activeDocument) setFindActiveResult(0);
  }, [workspace.activeDocument]);

  useEffect(() => {
    if (!workspace.activeDocument) setFindOpen(false);
  }, [workspace.activeDocument]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        (event.metaKey || event.ctrlKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLocaleLowerCase() === "f"
      ) {
        if (
          workspace.activeDocument &&
          !settingsOpen &&
          dialog === null &&
          moveTarget === null
        ) {
          event.preventDefault();
          openDocumentFind();
        }
        return;
      }
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
  }, [
    dialog,
    moveTarget,
    openDocumentFind,
    settings.folderPaneOpen,
    settings.listPaneOpen,
    settingsOpen,
    updateLayout,
    workspace.activeDocument,
  ]);

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

  const selectTab = async (identity: string) => {
    workspace.setActiveDocument(identity);
  };

  const closeTab = async (identity: string) => {
    await workspace.closeDocument(identity);
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
              {docsSourceCard}
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
            {aiMode ? (
              <FileExplorerTree
                activePath={workspace.activePath}
                documents={workspace.snapshot.documents}
                expandedPaths={expandedPaths}
                folders={workspace.snapshot.folders}
                onOpenDocument={(path) => void workspace.openDocument(path)}
                onSelectFolder={workspace.setSelectedFolder}
                onToggleFolder={toggleExpandedFolder}
                rootLabel={pinnedRootEntry?.label}
                rootName={rootName}
                selectedFolder={workspace.selectedFolder}
              />
            ) : (
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
                onTrash={(path, origin) =>
                  void confirmTrashFolder(path, origin)
                }
                selectedPath={workspace.selectedFolder}
              />
            )}
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
                {docsSourceCard}
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
                {!pinnedMode ? (
                  <button
                    className="icon-button"
                    aria-label={
                      activeSpace === "docs"
                        ? messages.app.chooseDocsRoot
                        : createDocumentLabel
                    }
                    onClick={() =>
                      activeSpace === "docs"
                        ? void openBrowseFolder()
                        : setDialog("document")
                    }
                    type="button"
                  >
                    <Plus aria-hidden="true" size={15} />
                  </button>
                ) : null}
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
            activePath={workspace.activePath}
            docsMode={false}
            documents={workspace.openDocuments}
            fullPathLabels={activeSpace === "docs"}
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
                  <button
                    aria-label={messages.app.exportPdf}
                    className="icon-button current-document-export"
                    onClick={() => {
                      void printDocument().catch((cause: unknown) => {
                        setDocumentSourceError(
                          cause instanceof Error
                            ? cause.message
                            : String(cause),
                        );
                      });
                    }}
                    title={messages.app.exportPdf}
                    type="button"
                  >
                    <FileDown aria-hidden="true" size={15} />
                  </button>
                  {workspace.saveStatus === "dirty" ||
                  workspace.saveStatus === "saving" ||
                  workspace.saveStatus === "error" ? (
                    <span className={`save-status ${workspace.saveStatus}`}>
                      {saveLabel(workspace.saveStatus, messages)}
                    </span>
                  ) : null}
                  {modeControl ? (
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

          {findOpen && workspace.activeDocument ? (
            <DocumentFindBar
              activeIndex={normalizedFindIndex}
              inputRef={findInputRef}
              matches={findMatches.length}
              messages={messages.app}
              onClose={closeDocumentFind}
              onMove={moveDocumentFind}
              onQueryChange={(query) => {
                setFindQuery(query);
                setFindActiveResult(0);
              }}
              query={findQuery}
            />
          ) : null}

          {(documentSourceError ?? workspaceErrorMessage) && (
            <div className="inline-notice" role="alert">
              <span>{documentSourceError ?? workspaceErrorMessage}</span>
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
                  findActiveIndex={
                    findOpen && findMatches.length > 0
                      ? normalizedFindIndex
                      : null
                  }
                  findMatches={findOpen ? findMatches : undefined}
                  onChange={workspace.updateBody}
                  openDocumentKeys={workspace.openDocuments.map(
                    (document) => document.path,
                  )}
                  value={workspace.activeDocument.body}
                  visible={workspace.activeDocument.mode !== "view"}
                />
              </div>
              <MarkdownView
                body={workspace.activeDocument.body}
                className={
                  workspace.activeDocument.mode === "edit"
                    ? "print-only"
                    : undefined
                }
                documentPath={workspace.activeDocument.path}
                findActiveIndex={
                  findOpen && findMatches.length > 0
                    ? normalizedFindIndex
                    : null
                }
                findMatches={findOpen ? findMatches : undefined}
                root={workspace.activeDocument.root}
              />
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
              {!pinnedMode ? (
                <button
                  className="primary-button"
                  onClick={() =>
                    activeSpace === "docs"
                      ? void openBrowseFolder()
                      : setDialog("document")
                  }
                  type="button"
                >
                  {activeSpace === "docs"
                    ? messages.app.chooseDocsRoot
                    : createDocumentLabel}
                </button>
              ) : null}
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
        <NameDialog
          initialValue={labelTarget?.label ?? ""}
          label={messages.pinnedRoots.labelField}
          onCancel={() => setLabelTarget(null)}
          onSubmit={savePinnedLabel}
          open={labelTarget !== null}
          submitLabel={messages.pinnedRoots.saveLabel}
          title={messages.pinnedRoots.labelTitle}
          validate={validateDocsFolderLabel}
          validationMessage={messages.pinnedRoots.labelInvalid}
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
          spacePalette={settings.spacePalette}
          onClose={closeSettings}
          onLanguageChange={(language) => updateLayout({ language })}
          onSpacePaletteChange={(spacePalette) =>
            updateLayout({ spacePalette })
          }
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

function docsSourceModeFromValue(value: string): DocsSourceMode {
  return value === "pinned" ? "pinned" : "browse";
}

function pathsOverlap(left: string, right: string): boolean {
  const leftParts = left.split(/[\\/]+/).filter(Boolean);
  const rightParts = right.split(/[\\/]+/).filter(Boolean);
  const shared = Math.min(leftParts.length, rightParts.length);
  return leftParts
    .slice(0, shared)
    .every((part, index) => part === rightParts[index]);
}

function messageFromUnknown(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
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
