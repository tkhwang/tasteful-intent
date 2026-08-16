import { Check, ChevronDown, FolderPlus, Pencil, X } from "lucide-react";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useI18n } from "@/lib/i18n";
import { formatRootDisplay } from "@/lib/rootDisplay";
import type { DocsPinnedRoot } from "@/types/library";

type PinnedRootsSwitcherProps = {
  readonly roots: readonly DocsPinnedRoot[];
  readonly activeRoot: string | null;
  readonly leadingControl: ReactNode;
  readonly onPin: () => void;
  readonly onEditLabel: (root: string) => void;
  readonly onSelect: (root: string) => Promise<boolean>;
  readonly onUnpin: (root: string) => Promise<boolean>;
};

export function PinnedRootsSwitcher({
  roots,
  activeRoot,
  leadingControl,
  onPin,
  onEditLabel,
  onSelect,
  onUnpin,
}: PinnedRootsSwitcherProps) {
  const messages = useI18n();
  const [expanded, setExpanded] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pendingFocusIndexRef = useRef<number | null>(null);
  const activeIndex = Math.max(
    roots.findIndex(({ root }) => root === activeRoot),
    0,
  );
  const active = roots[activeIndex] ?? roots[0];

  useEffect(() => {
    if (!expanded || roots.length === 0) return;
    const requested = pendingFocusIndexRef.current ?? activeIndex;
    pendingFocusIndexRef.current = null;
    itemRefs.current[Math.min(requested, roots.length - 1)]?.focus();
  }, [activeIndex, expanded, roots]);

  if (!active) return null;

  const activeLabel = active.label;
  const close = () => {
    setExpanded(false);
    openerRef.current?.focus();
  };
  const select = async (root: string) => {
    try {
      const changed = await onSelect(root);
      if (changed) close();
    } catch (cause) {
      reportError(cause);
    }
  };
  const handleMenuKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const nextIndex =
      event.key === "ArrowDown"
        ? (index + 1) % roots.length
        : event.key === "ArrowUp"
          ? (index - 1 + roots.length) % roots.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? roots.length - 1
              : null;
    if (nextIndex != null) {
      event.preventDefault();
      itemRefs.current[nextIndex]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <div className="pinned-roots-switcher source-card">
      <fieldset className="docs-root-shortcuts">
        <legend className="sr-only">{messages.pinnedRoots.groupLabel}</legend>
        {leadingControl}
        {roots.map(({ root, label }) => {
          const selected = root === active.root;
          return (
            <button
              aria-label={messages.pinnedRoots.shortcut(label, root)}
              aria-pressed={selected}
              className={`docs-root-shortcut ${selected ? "active" : ""}`}
              key={root}
              onClick={() => void select(root)}
              title={`${label}: ${root}`}
              type="button"
            >
              {label}
            </button>
          );
        })}
        <button
          aria-label={messages.pinnedRoots.pinFolder}
          className="pinned-root-add"
          onClick={onPin}
          title={messages.pinnedRoots.pinFolder}
          type="button"
        >
          <FolderPlus aria-hidden="true" size={15} />
        </button>
      </fieldset>

      <button
        aria-expanded={expanded}
        aria-haspopup="menu"
        aria-label={messages.pinnedRoots.toggle(activeLabel, active.root)}
        className="docs-root-current"
        onClick={() => setExpanded((current) => !current)}
        ref={openerRef}
        title={`${activeLabel}: ${active.root}`}
        type="button"
      >
        <span className="docs-root-current-letter">{activeLabel}</span>
        <span className="docs-root-current-path">{active.root}</span>
        <ChevronDown
          aria-hidden="true"
          className={expanded ? "expanded" : undefined}
          size={14}
        />
      </button>

      {expanded ? (
        <div
          aria-label={messages.pinnedRoots.menuLabel}
          className="docs-root-menu pinned-root-menu"
          role="menu"
        >
          {roots.map(({ root, label }, index) => {
            const selected = root === active.root;
            return (
              <div
                className="pinned-root-menu-row"
                key={root}
                role="presentation"
              >
                <button
                  aria-checked={selected}
                  aria-label={messages.pinnedRoots.shortcut(label, root)}
                  className={`pinned-root-menu-item ${selected ? "active" : ""}`}
                  onClick={() => void select(root)}
                  onKeyDown={(event) => handleMenuKeyDown(event, index)}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  role="menuitemradio"
                  title={`${label}: ${root}`}
                  type="button"
                >
                  <span className="docs-root-menu-letter">{label}</span>
                  <span className="docs-root-menu-copy">
                    <strong>{formatRootDisplay(root).leaf}</strong>
                    <small>{root}</small>
                  </span>
                  {selected ? <Check aria-hidden="true" size={13} /> : null}
                </button>
                <button
                  aria-label={messages.pinnedRoots.editLabel(root)}
                  className="pinned-root-menu-edit"
                  onClick={() => onEditLabel(root)}
                  type="button"
                >
                  <Pencil aria-hidden="true" size={13} />
                </button>
                <button
                  aria-label={messages.pinnedRoots.unpinFolder(root)}
                  className="pinned-root-menu-remove"
                  onClick={async () => {
                    try {
                      if (await onUnpin(root)) {
                        pendingFocusIndexRef.current = index;
                      }
                    } catch (cause) {
                      reportError(cause);
                    }
                  }}
                  type="button"
                >
                  <X aria-hidden="true" size={13} />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
