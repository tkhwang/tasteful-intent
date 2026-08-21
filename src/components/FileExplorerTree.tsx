import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { useMemo } from "react";
import type { DocumentEntry, FolderEntry } from "@/types/library";

type FileExplorerTreeProps = {
  readonly activePath: string | null;
  readonly documents: readonly DocumentEntry[];
  readonly expandedPaths: ReadonlySet<string>;
  readonly folders: readonly FolderEntry[];
  readonly onOpenDocument: (path: string) => void;
  readonly onSelectFolder: (path: string) => void;
  readonly onToggleFolder: (path: string) => void;
  readonly rootLabel?: string;
  readonly rootName: string;
  readonly selectedFolder: string;
};

type ExplorerEntry =
  | { readonly kind: "folder"; readonly value: FolderEntry }
  | { readonly kind: "document"; readonly value: DocumentEntry };

export function FileExplorerTree({
  activePath,
  documents,
  expandedPaths,
  folders,
  onOpenDocument,
  onSelectFolder,
  onToggleFolder,
  rootLabel,
  rootName,
  selectedFolder,
}: FileExplorerTreeProps) {
  const entriesByParent = useMemo(
    () => groupEntries(folders, documents),
    [documents, folders],
  );
  const rootText = rootLabel ? `[${rootLabel}] ${rootName}` : rootName;

  return (
    <nav aria-label={rootText} className="file-explorer-tree">
      <button
        aria-current={selectedFolder === "" ? "page" : undefined}
        className="file-explorer-row folder-row"
        onClick={() => onSelectFolder("")}
        title={rootText}
        type="button"
      >
        <span aria-hidden="true" className="folder-chevron-spacer" />
        <FolderOpen aria-hidden="true" size={15} strokeWidth={1.7} />
        <span>{rootText}</span>
      </button>
      <ExplorerChildren
        activePath={activePath}
        depth={1}
        entriesByParent={entriesByParent}
        expandedPaths={expandedPaths}
        onOpenDocument={onOpenDocument}
        onSelectFolder={onSelectFolder}
        onToggleFolder={onToggleFolder}
        parent=""
        selectedFolder={selectedFolder}
      />
    </nav>
  );
}

type ExplorerChildrenProps = Pick<
  FileExplorerTreeProps,
  | "activePath"
  | "expandedPaths"
  | "onOpenDocument"
  | "onSelectFolder"
  | "onToggleFolder"
  | "selectedFolder"
> & {
  readonly depth: number;
  readonly entriesByParent: ReadonlyMap<string, readonly ExplorerEntry[]>;
  readonly parent: string;
};

function ExplorerChildren(props: ExplorerChildrenProps) {
  const entries = props.entriesByParent.get(props.parent) ?? [];
  return entries.map((entry) =>
    entry.kind === "folder" ? (
      <FolderBranch entry={entry.value} key={entry.value.path} {...props} />
    ) : (
      <DocumentButton
        active={props.activePath === entry.value.path}
        depth={props.depth}
        document={entry.value}
        key={entry.value.path}
        onOpen={props.onOpenDocument}
      />
    ),
  );
}

type FolderBranchProps = ExplorerChildrenProps & {
  readonly entry: FolderEntry;
};

function FolderBranch({ entry, ...props }: FolderBranchProps) {
  const expanded = props.expandedPaths.has(entry.path);
  const hasChildren = (props.entriesByParent.get(entry.path)?.length ?? 0) > 0;
  const Icon = expanded ? FolderOpen : Folder;
  return (
    <div>
      <button
        aria-current={props.selectedFolder === entry.path ? "page" : undefined}
        aria-expanded={hasChildren ? expanded : undefined}
        className="file-explorer-row folder-row"
        onClick={() => {
          props.onSelectFolder(entry.path);
          if (hasChildren) props.onToggleFolder(entry.path);
        }}
        style={{ paddingInlineStart: `${8 + props.depth * 14}px` }}
        title={entry.path}
        type="button"
      >
        {hasChildren ? (
          <ChevronRight
            aria-hidden="true"
            className={expanded ? "folder-chevron expanded" : "folder-chevron"}
            size={12}
          />
        ) : (
          <span aria-hidden="true" className="folder-chevron-spacer" />
        )}
        <Icon aria-hidden="true" size={15} strokeWidth={1.7} />
        <span>{entry.name}</span>
      </button>
      {expanded ? (
        <ExplorerChildren
          {...props}
          depth={props.depth + 1}
          parent={entry.path}
        />
      ) : null}
    </div>
  );
}

type DocumentButtonProps = {
  readonly active: boolean;
  readonly depth: number;
  readonly document: DocumentEntry;
  readonly onOpen: (path: string) => void;
};

function DocumentButton({
  active,
  depth,
  document,
  onOpen,
}: DocumentButtonProps) {
  return (
    <button
      aria-current={active ? "page" : undefined}
      className="file-explorer-row file-row"
      onClick={() => onOpen(document.path)}
      style={{ paddingInlineStart: `${8 + depth * 14}px` }}
      title={document.path}
      type="button"
    >
      <span aria-hidden="true" className="folder-chevron-spacer" />
      <FileText aria-hidden="true" size={14} strokeWidth={1.7} />
      <span>{document.title}</span>
    </button>
  );
}

function groupEntries(
  folders: readonly FolderEntry[],
  documents: readonly DocumentEntry[],
): ReadonlyMap<string, readonly ExplorerEntry[]> {
  const grouped = new Map<string, ExplorerEntry[]>();
  for (const value of folders)
    appendEntry(grouped, value.parent, { kind: "folder", value });
  for (const value of documents)
    appendEntry(grouped, value.parent, { kind: "document", value });
  for (const entries of grouped.values()) {
    entries.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
      return entryName(left).localeCompare(entryName(right), undefined, {
        sensitivity: "base",
      });
    });
  }
  return grouped;
}

function appendEntry(
  grouped: Map<string, ExplorerEntry[]>,
  parent: string,
  entry: ExplorerEntry,
) {
  grouped.set(parent, [...(grouped.get(parent) ?? []), entry]);
}

function entryName(entry: ExplorerEntry): string {
  return entry.kind === "folder" ? entry.value.name : entry.value.title;
}
