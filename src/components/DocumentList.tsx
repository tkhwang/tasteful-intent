import { FileText } from "lucide-react";
import { useMemo } from "react";
import { ContextMenu } from "@/components/ContextMenu";
import { useI18n } from "@/lib/i18n";
import type { DocumentDensity, DocumentEntry } from "@/types/library";

type DocumentListProps = {
  readonly documents: readonly DocumentEntry[];
  readonly snippets: ReadonlyMap<string, string>;
  readonly selectedPath: string | null;
  readonly density: DocumentDensity;
  readonly onSelect: (path: string) => void;
  readonly onMove: (path: string, origin: HTMLElement) => void;
  readonly onRename: (path: string, origin: HTMLElement) => void;
  readonly onTrash: (path: string, origin: HTMLElement) => void;
  readonly readOnly?: boolean;
};

export function DocumentList({
  documents,
  snippets,
  selectedPath,
  density,
  onSelect,
  onMove,
  onRename,
  onTrash,
  readOnly = false,
}: DocumentListProps) {
  const messages = useI18n();
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(messages.locale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [messages.locale],
  );

  if (documents.length === 0) {
    return <p className="pane-empty">{messages.list.empty}</p>;
  }

  return (
    <div
      aria-label={messages.list.label}
      className="document-list"
      role="listbox"
    >
      {documents.map((document) => {
        const snippet = snippets.get(document.path) ?? "";
        const row = (
          triggerProps?: Parameters<
            Parameters<typeof ContextMenu>[0]["children"]
          >[0],
        ) => (
          <button
            aria-selected={selectedPath === document.path}
            className="document-row"
            data-density={density}
            onClick={() => onSelect(document.path)}
            role="option"
            type="button"
            {...triggerProps}
          >
            <FileText aria-hidden="true" size={15} strokeWidth={1.6} />
            <span className="document-copy">
              <strong>{document.title}</strong>
              {density !== "simple" && snippet ? (
                <span className="document-snippet">{snippet}</span>
              ) : null}
              {density === "full" ? (
                <time dateTime={new Date(document.updatedMs).toISOString()}>
                  {dateFormatter.format(document.updatedMs)}
                </time>
              ) : null}
            </span>
          </button>
        );
        return readOnly ? (
          <div key={document.path}>{row()}</div>
        ) : (
          <ContextMenu
            items={[
              {
                id: "rename",
                label: messages.menu.rename,
                onSelect: (origin) => onRename(document.path, origin),
              },
              {
                id: "move",
                label: messages.menu.move,
                onSelect: (origin) => onMove(document.path, origin),
              },
              {
                id: "trash",
                label: messages.menu.trash,
                danger: true,
                onSelect: (origin) => onTrash(document.path, origin),
              },
            ]}
            key={document.path}
            label={messages.list.actions(document.title)}
          >
            {row}
          </ContextMenu>
        );
      })}
    </div>
  );
}
