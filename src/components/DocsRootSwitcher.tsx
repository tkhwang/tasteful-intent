import {
  CircleAlert,
  FolderPlus,
  MoreHorizontal,
  Pin as PinIcon,
} from "lucide-react";
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/lib/i18n";
import { formatCompactRootPath, formatRootDisplay } from "@/lib/rootDisplay";
import type { DocsRootEntry } from "@/types/library";

export type RootAvailability = "available" | "unavailable";

type DocsRootSwitcherProps = {
  readonly roots: readonly DocsRootEntry[];
  readonly activeRoot: string | null;
  readonly availability: ReadonlyMap<string, RootAvailability>;
  readonly onOpenFolder: () => void;
  readonly onSelect: (root: string) => Promise<boolean>;
  readonly onPin: (root: string, opener: HTMLElement) => void;
  readonly onUnpin: (root: string) => void;
  readonly onEditLabel: (root: string, opener: HTMLElement) => void;
  readonly onClose: (root: string) => Promise<boolean>;
  readonly onRefresh: (root: string) => Promise<boolean>;
};

type FocusRequest =
  | {
      readonly kind: "root";
      readonly root: string;
      readonly after: "any" | "unpinned";
      readonly target: "actions" | "pin";
    }
  | { readonly kind: "open" }
  | null;

type MenuAction = {
  readonly id: string;
  readonly label: string;
  readonly run: () => void | Promise<void>;
};

export function DocsRootSwitcher({
  roots,
  activeRoot,
  availability,
  onOpenFolder,
  onSelect,
  onPin,
  onUnpin,
  onEditLabel,
  onClose,
  onRefresh,
}: DocsRootSwitcherProps) {
  const messages = useI18n();
  const [menuRoot, setMenuRoot] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const openerRefs = useRef(new Map<string, HTMLButtonElement>());
  const pinRefs = useRef(new Map<string, HTMLButtonElement>());
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pinnedRoots = roots.filter(isPinnedRoot);
  const menuEntry = roots.find(({ root }) => root === menuRoot) ?? null;

  const closeMenu = useCallback(
    (restoreFocus = true) => {
      const root = menuRoot;
      setMenuRoot(null);
      if (restoreFocus && root) openerRefs.current.get(root)?.focus();
    },
    [menuRoot],
  );

  useEffect(() => {
    if (!menuEntry) return;
    itemRefs.current[0]?.focus();
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      const opener = openerRefs.current.get(menuEntry.root);
      if (
        menuRef.current?.contains(event.target) ||
        opener?.contains(event.target)
      ) {
        return;
      }
      closeMenu();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [closeMenu, menuEntry]);

  useEffect(() => {
    if (!focusRequest) return;
    if (
      focusRequest.kind === "root" &&
      focusRequest.after === "unpinned" &&
      roots.find(({ root }) => root === focusRequest.root)?.label !== null
    ) {
      return;
    }
    const target =
      focusRequest.kind === "open"
        ? openButtonRef.current
        : focusRequest.target === "pin"
          ? pinRefs.current.get(focusRequest.root)
          : openerRefs.current.get(focusRequest.root);
    if (!target) return;
    target.focus();
    setFocusRequest(null);
  }, [focusRequest, roots]);

  const selectRoot = async (root: string) => {
    try {
      await onSelect(root);
    } catch (cause) {
      reportError(cause);
    }
  };

  const menuActions = useMemo<MenuAction[]>(() => {
    if (!menuEntry) return [];
    const opener = () => openerRefs.current.get(menuEntry.root);
    const actions: MenuAction[] = [];
    if (availability.get(menuEntry.root) === "unavailable") {
      actions.push({
        id: "refresh",
        label: messages.docsRoots.refresh,
        run: async () => {
          if (await onRefresh(menuEntry.root)) closeMenu();
        },
      });
    }
    if (menuEntry.label !== null) {
      actions.push({
        id: "edit-label",
        label: messages.docsRoots.editLabel,
        run: () => {
          const trigger = opener();
          if (!trigger) return;
          setMenuRoot(null);
          onEditLabel(menuEntry.root, trigger);
        },
      });
    } else {
      actions.push({
        id: "close",
        label: messages.docsRoots.close,
        run: async () => {
          const index = roots.findIndex(({ root }) => root === menuEntry.root);
          const fallback = roots[index + 1] ?? roots[index - 1] ?? null;
          if (!(await onClose(menuEntry.root))) return;
          setMenuRoot(null);
          setFocusRequest(
            fallback
              ? {
                  kind: "root",
                  root: fallback.root,
                  after: "any",
                  target: "actions",
                }
              : { kind: "open" },
          );
        },
      });
    }
    return actions;
  }, [
    availability,
    closeMenu,
    menuEntry,
    messages.docsRoots,
    onClose,
    onEditLabel,
    onRefresh,
    roots,
  ]);

  const runAction = async (action: MenuAction) => {
    try {
      await action.run();
    } catch (cause) {
      reportError(cause);
    }
  };

  const handleMenuKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const lastIndex = menuActions.length - 1;
    const nextIndex =
      event.key === "ArrowDown"
        ? (index + 1) % menuActions.length
        : event.key === "ArrowUp"
          ? (index - 1 + menuActions.length) % menuActions.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? lastIndex
              : null;
    if (nextIndex !== null) {
      event.preventDefault();
      itemRefs.current[nextIndex]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const action = menuActions[index];
      if (action) void runAction(action);
    }
  };

  const setOpenerRef = (root: string, node: HTMLButtonElement | null) => {
    if (node) openerRefs.current.set(root, node);
    else openerRefs.current.delete(root);
  };

  const setPinRef = (root: string, node: HTMLButtonElement | null) => {
    if (node) pinRefs.current.set(root, node);
    else pinRefs.current.delete(root);
  };

  const togglePin = (entry: DocsRootEntry, opener: HTMLButtonElement) => {
    if (entry.label === null) {
      onPin(entry.root, opener);
      return;
    }
    onUnpin(entry.root);
    setFocusRequest({
      kind: "root",
      root: entry.root,
      after: "unpinned",
      target: "pin",
    });
  };

  return (
    <div className="docs-root-switcher source-card">
      <div
        aria-label={messages.docsRoots.pinnedGroupLabel}
        className="docs-root-pinned-row"
        role="toolbar"
      >
        {pinnedRoots.map((entry) => (
          <PinnedRootShortcut
            active={entry.root === activeRoot}
            availability={availability.get(entry.root) ?? "available"}
            entry={entry}
            key={entry.root}
            onSelect={selectRoot}
          />
        ))}
        <button
          aria-label={messages.app.chooseDocsRoot}
          className="docs-root-open"
          onClick={onOpenFolder}
          ref={openButtonRef}
          title={messages.app.chooseDocsRoot}
          type="button"
        >
          <FolderPlus aria-hidden="true" size={15} />
        </button>
      </div>
      <ul
        aria-label={messages.docsRoots.groupLabel}
        className="docs-root-path-list"
      >
        {roots.map((entry) => (
          <RootPathControl
            active={entry.root === activeRoot}
            availability={availability.get(entry.root) ?? "available"}
            entry={entry}
            key={entry.root}
            menuExpanded={menuRoot === entry.root}
            onMenu={() =>
              setMenuRoot((current) =>
                current === entry.root ? null : entry.root,
              )
            }
            onMenuRef={setOpenerRef}
            onPinRef={setPinRef}
            onSelect={selectRoot}
            onTogglePin={togglePin}
          />
        ))}
      </ul>
      {menuEntry ? (
        <div
          aria-label={messages.docsRoots.menu(
            formatRootDisplay(menuEntry.root).leaf,
            menuEntry.root,
          )}
          className="docs-root-actions-menu"
          ref={menuRef}
          role="menu"
        >
          {menuActions.map((action, index) => (
            <button
              key={action.id}
              onClick={() => void runAction(action)}
              onKeyDown={(event) => handleMenuKeyDown(event, index)}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              role="menuitem"
              tabIndex={-1}
              type="button"
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type PinnedRootShortcutProps = {
  readonly active: boolean;
  readonly availability: RootAvailability;
  readonly entry: DocsRootEntry & { readonly label: string };
  readonly onSelect: (root: string) => Promise<void>;
};

function PinnedRootShortcut({
  active,
  availability,
  entry,
  onSelect,
}: PinnedRootShortcutProps) {
  const messages = useI18n();
  const display = formatRootDisplay(entry.root);
  const unavailable = availability === "unavailable";

  return (
    <button
      aria-label={messages.docsRoots.selectPinnedShortcut(
        entry.label,
        display.leaf,
        entry.root,
        unavailable,
      )}
      aria-pressed={active}
      className={`docs-root-shortcut ${unavailable ? "unavailable" : ""}`}
      onClick={() => void onSelect(entry.root)}
      title={`[${entry.label}] ${entry.root}`}
      type="button"
    >
      <span className="docs-root-label">{entry.label}</span>
      {unavailable ? (
        <CircleAlert
          aria-label={messages.docsRoots.unavailable}
          className="docs-root-unavailable-icon"
          size={11}
        />
      ) : null}
    </button>
  );
}

type RootPathControlProps = {
  readonly active: boolean;
  readonly availability: RootAvailability;
  readonly entry: DocsRootEntry;
  readonly menuExpanded: boolean;
  readonly onMenu: () => void;
  readonly onMenuRef: (root: string, node: HTMLButtonElement | null) => void;
  readonly onPinRef: (root: string, node: HTMLButtonElement | null) => void;
  readonly onSelect: (root: string) => Promise<void>;
  readonly onTogglePin: (
    entry: DocsRootEntry,
    opener: HTMLButtonElement,
  ) => void;
};

function RootPathControl({
  active,
  availability,
  entry,
  menuExpanded,
  onMenu,
  onMenuRef,
  onPinRef,
  onSelect,
  onTogglePin,
}: RootPathControlProps) {
  const messages = useI18n();
  const display = formatRootDisplay(entry.root);
  const compactPath = formatCompactRootPath(entry.root);
  const unavailable = availability === "unavailable";
  const pinned = entry.label !== null;
  const selectLabel =
    pinned && entry.label !== null
      ? messages.docsRoots.selectPinned(
          entry.label,
          display.leaf,
          entry.root,
          unavailable,
        )
      : messages.docsRoots.selectUnpinned(
          display.leaf,
          entry.root,
          unavailable,
        );

  return (
    <li
      className={`docs-root-path-row ${pinned ? "pinned" : "unpinned"} ${unavailable ? "unavailable" : ""}`}
      data-root={entry.root}
    >
      <button
        aria-label={selectLabel}
        aria-pressed={active}
        className="docs-root-select"
        onClick={() => void onSelect(entry.root)}
        title={`${entry.label ? `[${entry.label}] ` : ""}${entry.root}`}
        type="button"
      >
        {entry.label !== null ? (
          <>
            <span className="docs-root-path-label">{entry.label}</span>
            <span aria-hidden="true" className="docs-root-path-divider">
              |
            </span>
          </>
        ) : null}
        <span className="docs-root-path">{compactPath}</span>
        {unavailable ? (
          <CircleAlert
            aria-label={messages.docsRoots.unavailable}
            className="docs-root-unavailable-icon"
            size={11}
          />
        ) : null}
      </button>
      <button
        aria-label={messages.docsRoots.pinToggle(
          display.leaf,
          entry.root,
          pinned,
        )}
        aria-pressed={pinned}
        className="docs-root-pin-toggle"
        onClick={(event) => onTogglePin(entry, event.currentTarget)}
        ref={(node) => onPinRef(entry.root, node)}
        title={messages.docsRoots.pinToggle(display.leaf, entry.root, pinned)}
        type="button"
      >
        <PinIcon aria-hidden="true" size={13} />
      </button>
      <button
        aria-expanded={menuExpanded}
        aria-haspopup="menu"
        aria-label={messages.docsRoots.actions(display.leaf, entry.root)}
        className="docs-root-actions"
        onClick={onMenu}
        ref={(node) => onMenuRef(entry.root, node)}
        title={messages.docsRoots.actions(display.leaf, entry.root)}
        type="button"
      >
        <MoreHorizontal aria-hidden="true" size={13} />
      </button>
    </li>
  );
}

function isPinnedRoot(
  entry: DocsRootEntry,
): entry is DocsRootEntry & { readonly label: string } {
  return entry.label !== null;
}
