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
import {
  DocsRootSwitcher,
  type RootAvailability,
} from "@/components/DocsRootSwitcher";
import { DocumentList } from "@/components/DocumentList";
import { FileExplorerTree } from "@/components/FileExplorerTree";
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
  DocsRootEntry,
  DocumentDensity,
  EditorMode,
  LayoutSettings,
  LibrarySnapshot,
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

type DocsNavigationState = {
  readonly selectedFolder: string;
  readonly expandedPaths: ReadonlySet<string>;
};

type DocsRuntimeState = {
  readonly navigation: Map<string, DocsNavigationState>;
  readonly availability: Map<string, RootAvailability>;
  readonly preflightSnapshots: Map<string, LibrarySnapshot>;
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

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);

  return matches;
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
    const write = settingsWriteQueueRef.current.then(async () => {
      const current = settingsRef.current;
      if (!current) return;
      const next = update(current);
      if (Object.is(current, next)) return;
      await saveSettings(next);
      settingsRef.current = next;
      setSettings(next);
    });
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
  const docsRuntimeRef = useRef<DocsRuntimeState>({
    navigation: new Map(),
    availability: new Map(),
    preflightSnapshots: new Map(),
  });

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
      : settings.docsRoot;

  if (!root) {
    const chooseDocsFolder = async () => {
      const selected = await chooseLibrary(messages.app.chooseDocsRoot);
      if (!selected) return;
      try {
        const canonicalRoot = await resolveLibraryRoot(selected);
        const snapshot = await scanDocsRoot(canonicalRoot);
        docsRuntimeRef.current.preflightSnapshots.set(canonicalRoot, snapshot);
        docsRuntimeRef.current.availability.set(canonicalRoot, "available");
        await onSettingsChange((current) => ({
          ...current,
          docsRoots: current.docsRoots.some(
            ({ root: existingRoot }) => existingRoot === canonicalRoot,
          )
            ? current.docsRoots
            : [...current.docsRoots, { root: canonicalRoot, label: null }],
          docsRoot: canonicalRoot,
          tabSessions: {
            ...current.tabSessions,
            docs: {
              ...current.tabSessions.docs,
              [canonicalRoot]: current.tabSessions.docs[canonicalRoot] ?? {
                paths: [],
                activePath: null,
              },
            },
          },
        }));
        setDocumentSourceError(null);
      } catch (cause) {
        setDocumentSourceError(messageFromUnknown(cause));
      }
    };
    return (
      <WindowFrame>
        <DocsWelcomeScreen
          errorMessage={documentSourceError}
          onChoose={chooseDocsFolder}
          onClearError={() => setDocumentSourceError(null)}
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
      docsRuntime={docsRuntimeRef.current}
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
        {messages.app.docsBody ? <p>{messages.app.docsBody}</p> : null}
        {errorMessage ? (
          <div className="inline-notice" role="alert">
            <span>{errorMessage}</span>
            <button
              aria-label={messages.app.closeError}
              className="icon-button"
              onClick={onClearError}
              type="button"
            >
              <X aria-hidden="true" size={14} />
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
  readonly docsRuntime: DocsRuntimeState;
};

function LibraryApp({
  root,
  settings,
  onSettingsChange,
  docsRuntime,
}: LibraryAppProps) {
  const messages = useI18n();
  const rootName = formatRootDisplay(root).leaf;
  const defaultMode = settings.activeSpace === "docs" ? "view" : "edit";
  const activeSpace = settings.activeSpace;
  const aiMode = activeSpace === "docs";
  const rootEntry = settings.docsRoots.find(
    ({ root: entryRoot }) => entryRoot === root,
  );
  const initialNavigation = docsRuntime.navigation.get(root) ?? {
    selectedFolder: "",
    expandedPaths: new Set<string>(),
  };
  const [initialSnapshot] = useState(() => {
    const snapshot = docsRuntime.preflightSnapshots.get(root);
    docsRuntime.preflightSnapshots.delete(root);
    return snapshot;
  });
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(
    initialNavigation.expandedPaths,
  );
  const persistTabSession = useCallback(
    (session: TabSession) => {
      void onSettingsChange((current) => {
        const previous =
          activeSpace === "intent"
            ? current.tabSessions.intent
            : (current.tabSessions.docs[root] ?? {
                paths: [],
                activePath: null,
              });
        if (sameSession(previous, session)) return current;
        return {
          ...current,
          tabSessions: {
            ...current.tabSessions,
            ...(activeSpace === "intent"
              ? { intent: session }
              : {
                  docs: {
                    ...current.tabSessions.docs,
                    [root]: session,
                  },
                }),
          },
        };
      });
    },
    [activeSpace, onSettingsChange, root],
  );
  const workspace = useLibraryWorkspace(root, {
    defaultMode,
    initialSession:
      activeSpace === "intent"
        ? settings.tabSessions.intent
        : (settings.tabSessions.docs[root] ?? {
            paths: [],
            activePath: null,
          }),
    initialSnapshot: aiMode ? initialSnapshot : undefined,
    initialSelectedFolder: aiMode
      ? initialNavigation.selectedFolder
      : undefined,
    onSelectedFolderChange: aiMode
      ? (selectedFolder) => {
          const previous =
            docsRuntime.navigation.get(root) ?? initialNavigation;
          docsRuntime.navigation.set(root, { ...previous, selectedFolder });
        }
      : undefined,
    onSessionChange: persistTabSession,
    scan: aiMode ? scanDocsRoot : undefined,
  });
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [labelTarget, setLabelTarget] = useState<DocsRootEntry | null>(null);
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
  const compactNavigation = useMediaQuery("(max-width: 900px)");
  const findMatches = useMemo(
    () => findLiteralMatches(workspace.activeDocument?.body ?? "", findQuery),
    [findQuery, workspace.activeDocument?.body],
  );
  const normalizedFindIndex =
    findMatches.length > 0
      ? ((findActiveResult % findMatches.length) + findMatches.length) %
        findMatches.length
      : 0;
  const folderVisible =
    settings.listPaneOpen && settings.folderPaneOpen && !compactNavigation;
  const effectivePaneLayout = {
    folderPaneOpen: folderVisible,
    listPaneOpen: settings.listPaneOpen,
  };
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
  const [, setAvailabilityVersion] = useState(0);
  const startupRecoveryAttemptedRef = useRef(false);
  const workspaceErrorMessage =
    aiMode && workspace.rootUnavailable
      ? messages.docsRoots.unavailable
      : workspace.errorMessage;

  const updateLayout = useCallback(
    (partial: Partial<LayoutSettings>) => {
      void onSettingsChange((current) => ({ ...current, ...partial }));
    },
    [onSettingsChange],
  );

  const markAvailability = useCallback(
    (targetRoot: string, next: RootAvailability) => {
      docsRuntime.availability.set(targetRoot, next);
      setAvailabilityVersion((version) => version + 1);
    },
    [docsRuntime],
  );

  const preflightRoot = async (
    targetRoot: string,
  ): Promise<LibrarySnapshot | null> => {
    try {
      const snapshot = await scanDocsRoot(targetRoot);
      docsRuntime.preflightSnapshots.set(targetRoot, snapshot);
      markAvailability(targetRoot, "available");
      setDocumentSourceError(null);
      return snapshot;
    } catch (cause) {
      markAvailability(targetRoot, "unavailable");
      setDocumentSourceError(messageFromUnknown(cause));
      return null;
    }
  };

  const activateRoot = async (
    targetRoot: string,
    refreshTarget = false,
  ): Promise<boolean> => {
    if (targetRoot === root && !refreshTarget) return true;
    if (!(await workspace.persistAllOpenDocuments())) return false;
    if (targetRoot === root) {
      const snapshot = await workspace.refresh();
      if (!snapshot) {
        markAvailability(targetRoot, "unavailable");
        return false;
      }
      markAvailability(targetRoot, "available");
      return true;
    }
    if (!(await preflightRoot(targetRoot))) return false;
    try {
      await onSettingsChange((current) => ({
        ...current,
        docsRoot: targetRoot,
      }));
      return true;
    } catch (cause) {
      docsRuntime.preflightSnapshots.delete(targetRoot);
      setDocumentSourceError(messageFromUnknown(cause));
      return false;
    }
  };

  const openDocsFolder = async (): Promise<void> => {
    const selected = await chooseLibrary(messages.app.chooseDocsRoot);
    if (!selected) return;
    try {
      const canonicalRoot = await resolveLibraryRoot(selected);
      if (
        settings.docsRoots.some(
          ({ root: existingRoot }) => existingRoot === canonicalRoot,
        )
      ) {
        await activateRoot(canonicalRoot);
        return;
      }
      if (!(await workspace.persistAllOpenDocuments())) return;
      if (!(await preflightRoot(canonicalRoot))) return;
      try {
        await onSettingsChange((current) => ({
          ...current,
          docsRoots: [
            ...current.docsRoots,
            { root: canonicalRoot, label: null },
          ],
          docsRoot: canonicalRoot,
          tabSessions: {
            ...current.tabSessions,
            docs: {
              ...current.tabSessions.docs,
              [canonicalRoot]: { paths: [], activePath: null },
            },
          },
        }));
      } catch (cause) {
        docsRuntime.preflightSnapshots.delete(canonicalRoot);
        setDocumentSourceError(messageFromUnknown(cause));
      }
    } catch (cause) {
      setDocumentSourceError(messageFromUnknown(cause));
    }
  };

  const closeDocsRoot = async (removedRoot: string): Promise<boolean> => {
    if (removedRoot === root && !(await workspace.persistAllOpenDocuments())) {
      return false;
    }
    try {
      await onSettingsChange((current) => {
        const removedIndex = current.docsRoots.findIndex(
          ({ root: entryRoot }) => entryRoot === removedRoot,
        );
        if (removedIndex < 0) return current;
        const docsRoots = current.docsRoots.filter(
          ({ root: entryRoot }) => entryRoot !== removedRoot,
        );
        const docs = Object.fromEntries(
          Object.entries(current.tabSessions.docs).filter(
            ([sessionRoot]) => sessionRoot !== removedRoot,
          ),
        );
        const fallback =
          current.docsRoots[removedIndex + 1] ??
          current.docsRoots[removedIndex - 1] ??
          null;
        return {
          ...current,
          docsRoots,
          docsRoot:
            current.docsRoot === removedRoot
              ? (fallback?.root ?? null)
              : current.docsRoot,
          tabSessions: { ...current.tabSessions, docs },
        };
      });
      docsRuntime.availability.delete(removedRoot);
      docsRuntime.navigation.delete(removedRoot);
      docsRuntime.preflightSnapshots.delete(removedRoot);
      return true;
    } catch (cause) {
      setDocumentSourceError(messageFromUnknown(cause));
      return false;
    }
  };

  const beginPin = (targetRoot: string, opener: HTMLElement) => {
    actionOriginRef.current = opener;
    setLabelTarget({
      root: targetRoot,
      label: suggestDocsFolderLabel(targetRoot),
    });
  };

  const beginEditLabel = (targetRoot: string, opener: HTMLElement) => {
    const entry = settings.docsRoots.find(
      ({ root: entryRoot }) => entryRoot === targetRoot,
    );
    if (!entry?.label) return;
    actionOriginRef.current = opener;
    setLabelTarget(entry);
  };

  const savePinnedLabel = async (label: string): Promise<void> => {
    if (!labelTarget) return;
    try {
      await onSettingsChange((current) => {
        const target = current.docsRoots.find(
          ({ root: entryRoot }) => entryRoot === labelTarget.root,
        );
        if (!target) return current;
        if (target.label !== null) {
          return {
            ...current,
            docsRoots: current.docsRoots.map((entry) =>
              entry.root === labelTarget.root ? { ...entry, label } : entry,
            ),
          };
        }
        const remaining = current.docsRoots.filter(
          ({ root: entryRoot }) => entryRoot !== labelTarget.root,
        );
        const pinned = remaining.filter((entry) => entry.label !== null);
        const unpinned = remaining.filter((entry) => entry.label === null);
        return {
          ...current,
          docsRoots: [
            ...pinned,
            { root: labelTarget.root, label },
            ...unpinned,
          ],
        };
      });
      setLabelTarget(null);
      restoreActionFocus(labelTarget.root);
    } catch (cause) {
      setDocumentSourceError(messageFromUnknown(cause));
    }
  };

  const unpinRoot = (targetRoot: string): void => {
    void onSettingsChange((current) => {
      const target = current.docsRoots.find(
        ({ root: entryRoot }) => entryRoot === targetRoot,
      );
      if (!target || target.label === null) return current;
      const remaining = current.docsRoots.filter(
        ({ root: entryRoot }) => entryRoot !== targetRoot,
      );
      const pinned = remaining.filter((entry) => entry.label !== null);
      const unpinned = remaining.filter((entry) => entry.label === null);
      return {
        ...current,
        docsRoots: [...pinned, { root: targetRoot, label: null }, ...unpinned],
      };
    }).catch((cause: unknown) => {
      setDocumentSourceError(messageFromUnknown(cause));
    });
  };

  useEffect(() => {
    if (!aiMode) return;
    if (!workspace.rootUnavailable) {
      markAvailability(root, "available");
      return;
    }
    if (initialSnapshot && docsRuntime.availability.get(root) === "available") {
      return;
    }
    markAvailability(root, "unavailable");
    if (startupRecoveryAttemptedRef.current) return;
    startupRecoveryAttemptedRef.current = true;
    let cancelled = false;
    void (async () => {
      for (const entry of settings.docsRoots) {
        if (entry.root === root) continue;
        try {
          const snapshot = await scanDocsRoot(entry.root);
          if (cancelled) return;
          docsRuntime.preflightSnapshots.set(entry.root, snapshot);
          markAvailability(entry.root, "available");
          await onSettingsChange((current) => ({
            ...current,
            docsRoot: entry.root,
          }));
          return;
        } catch {
          if (!cancelled) markAvailability(entry.root, "unavailable");
        }
      }
    })().catch((cause: unknown) => {
      if (!cancelled) setDocumentSourceError(messageFromUnknown(cause));
    });
    return () => {
      cancelled = true;
    };
  }, [
    aiMode,
    docsRuntime,
    initialSnapshot,
    markAvailability,
    onSettingsChange,
    root,
    settings.docsRoots,
    workspace.rootUnavailable,
  ]);

  const toggleExpandedFolder = (path: string) => {
    const next = new Set(expandedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    const previous = docsRuntime.navigation.get(root) ?? initialNavigation;
    docsRuntime.navigation.set(root, { ...previous, expandedPaths: next });
    setExpandedPaths(next);
  };

  const docsSourceCard = aiMode ? (
    <DocsRootSwitcher
      activeRoot={root}
      availability={docsRuntime.availability}
      onClose={closeDocsRoot}
      onEditLabel={beginEditLabel}
      onOpenFolder={() => void openDocsFolder()}
      onPin={beginPin}
      onRefresh={(targetRoot) => activateRoot(targetRoot, true)}
      onSelect={activateRoot}
      onUnpin={unpinRoot}
      roots={settings.docsRoots}
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
        if (settings.listPaneOpen && !compactNavigation) {
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
    compactNavigation,
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

  const restoreActionFocus = useCallback((fallbackRoot?: string) => {
    const origin = actionOriginRef.current;
    actionOriginRef.current = null;
    window.requestAnimationFrame(() => {
      if (origin?.isConnected) {
        origin.focus();
        return;
      }
      if (!fallbackRoot) return;
      const rootControl = Array.from(
        document.querySelectorAll<HTMLElement>(".docs-root-split"),
      ).find((element) => element.dataset.root === fallbackRoot);
      rootControl
        ?.querySelector<HTMLButtonElement>(".docs-root-actions")
        ?.focus();
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
                rootLabel={rootEntry?.label ?? undefined}
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
                <button
                  className="icon-button"
                  aria-label={
                    activeSpace === "docs"
                      ? messages.app.chooseDocsRoot
                      : createDocumentLabel
                  }
                  onClick={() =>
                    activeSpace === "docs"
                      ? void openDocsFolder()
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
            activePath={workspace.activePath}
            docsMode={false}
            documents={workspace.openDocuments}
            fullPathLabels={activeSpace === "docs"}
            leadingAction={
              <button
                aria-label={layoutControl.label}
                className="icon-button header-cycle-button layout-cycle-button"
                data-layout={layoutControl.state}
                onClick={() =>
                  updateLayout(nextPaneLayout(effectivePaneLayout))
                }
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
              <button
                className="primary-button"
                onClick={() =>
                  activeSpace === "docs"
                    ? void openDocsFolder()
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
        <NameDialog
          initialValue={labelTarget?.label ?? ""}
          label={messages.docsRoots.labelField}
          onCancel={() => {
            setLabelTarget(null);
            restoreActionFocus();
          }}
          onSubmit={savePinnedLabel}
          open={labelTarget !== null}
          submitLabel={messages.docsRoots.saveLabel}
          title={messages.docsRoots.labelTitle}
          validate={validateDocsFolderLabel}
          validationMessage={messages.docsRoots.labelInvalid}
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
