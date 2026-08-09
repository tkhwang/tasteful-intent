import { Check, ChevronDown, Plus } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import type { WorkspaceDocument } from "@/hooks/useLibraryWorkspace";
import { useI18n } from "@/lib/i18n";
import { formatRootDisplay } from "@/lib/rootDisplay";

type DocsRootSwitcherProps = {
  readonly documents: readonly WorkspaceDocument[];
  readonly activeIdentity: string;
  readonly getIdentity: (document: WorkspaceDocument) => string;
  readonly onOpenDocument: () => void;
  readonly onSelect: (identity: string) => Promise<void>;
};

const shortcutLabel = (index: number) =>
  index < 26
    ? String.fromCharCode("A".charCodeAt(0) + index)
    : String(index + 1);

const fullDocumentPath = (document: WorkspaceDocument) =>
  `${document.root}/${document.path}`;

export function DocsRootSwitcher({
  documents,
  activeIdentity,
  getIdentity,
  onOpenDocument,
  onSelect,
}: DocsRootSwitcherProps) {
  const messages = useI18n();
  const [expanded, setExpanded] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = documents.findIndex(
    (document) => getIdentity(document) === activeIdentity,
  );
  const activeDocument = documents[activeIndex] ?? documents[0];

  useEffect(() => {
    if (expanded) itemRefs.current[Math.max(activeIndex, 0)]?.focus();
  }, [activeIndex, expanded]);

  if (!activeDocument) return null;

  const activeLabel = shortcutLabel(Math.max(activeIndex, 0));
  const activePath = fullDocumentPath(activeDocument);
  const close = () => {
    setExpanded(false);
    openerRef.current?.focus();
  };

  const handleMenuKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const nextIndex =
      event.key === "ArrowDown"
        ? (index + 1) % documents.length
        : event.key === "ArrowUp"
          ? (index - 1 + documents.length) % documents.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? documents.length - 1
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
    <div className="docs-root-switcher source-card">
      <fieldset className="docs-root-shortcuts">
        <legend className="sr-only">{messages.docsRoots.groupLabel}</legend>
        {documents.map((document, index) => {
          const identity = getIdentity(document);
          const label = shortcutLabel(index);
          const fullPath = fullDocumentPath(document);
          const accessibleLabel = messages.docsRoots.shortcut(label, fullPath);

          return (
            <button
              aria-label={accessibleLabel}
              aria-pressed={identity === activeIdentity}
              className={`docs-root-shortcut ${identity === activeIdentity ? "active" : ""}`}
              key={identity}
              onClick={() => void onSelect(identity)}
              title={`${label}: ${fullPath}`}
              type="button"
            >
              {label}
            </button>
          );
        })}
        <button
          aria-label={messages.app.chooseDocsRoot}
          className="docs-root-open"
          onClick={onOpenDocument}
          title={messages.app.chooseDocsRoot}
          type="button"
        >
          <Plus aria-hidden="true" size={15} />
        </button>
      </fieldset>

      <button
        aria-expanded={expanded}
        aria-haspopup="menu"
        aria-label={messages.docsRoots.toggle(activeLabel, activePath)}
        className="docs-root-current"
        onClick={() => setExpanded((current) => !current)}
        ref={openerRef}
        title={`${activeLabel}: ${activePath}`}
        type="button"
      >
        <span className="docs-root-current-letter">{activeLabel}</span>
        <span className="docs-root-current-path">{activePath}</span>
        <ChevronDown
          aria-hidden="true"
          className={expanded ? "expanded" : undefined}
          size={14}
        />
      </button>

      {expanded ? (
        <div
          aria-label={messages.docsRoots.menuLabel}
          className="docs-root-menu"
          role="menu"
        >
          {documents.map((document, index) => {
            const identity = getIdentity(document);
            const label = shortcutLabel(index);
            const fullPath = fullDocumentPath(document);
            const folder = formatRootDisplay(document.root).leaf;
            const active = identity === activeIdentity;

            return (
              <button
                aria-checked={active}
                aria-label={messages.docsRoots.menuItem(
                  label,
                  folder,
                  fullPath,
                )}
                className={`docs-root-menu-item ${active ? "active" : ""}`}
                key={identity}
                onClick={() => void onSelect(identity).then(close)}
                onKeyDown={(event) => handleMenuKeyDown(event, index)}
                ref={(node) => {
                  itemRefs.current[index] = node;
                }}
                role="menuitemradio"
                title={`${label}: ${fullPath}`}
                type="button"
              >
                <span className="docs-root-menu-letter">{label}</span>
                <span className="docs-root-menu-copy">
                  <strong>{folder}</strong>
                  <small>{fullPath}</small>
                </span>
                {active ? <Check aria-hidden="true" size={13} /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
