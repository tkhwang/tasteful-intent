import { ChevronRight, Folder, Library } from "lucide-react";
import { useMemo } from "react";
import { ContextMenu } from "@/components/ContextMenu";
import { useI18n } from "@/lib/i18n";
import type { FolderEntry } from "@/types/library";

type FolderTreeProps = {
  readonly folders: readonly FolderEntry[];
  readonly rootName: string;
  readonly selectedPath: string;
  readonly onSelect: (path: string) => void;
  readonly onMove: (path: string, origin: HTMLElement) => void;
  readonly onRename: (path: string, origin: HTMLElement) => void;
  readonly onTrash: (path: string, origin: HTMLElement) => void;
  readonly readOnly?: boolean;
  readonly collapsible?: boolean;
  readonly expandedPaths?: ReadonlySet<string>;
  readonly onToggleExpanded?: (path: string) => void;
};

const emptyExpandedPaths: ReadonlySet<string> = new Set();

export function FolderTree({
  folders,
  rootName,
  selectedPath,
  onSelect,
  onMove,
  onRename,
  onTrash,
  readOnly = false,
  collapsible = false,
  expandedPaths = emptyExpandedPaths,
  onToggleExpanded,
}: FolderTreeProps) {
  const messages = useI18n();
  const children = useMemo(() => {
    const grouped = new Map<string, FolderEntry[]>();
    for (const folder of folders) {
      const entries = grouped.get(folder.parent) ?? [];
      entries.push(folder);
      grouped.set(folder.parent, entries);
    }
    for (const entries of grouped.values()) {
      entries.sort((left, right) => left.name.localeCompare(right.name));
    }
    return grouped;
  }, [folders]);

  return (
    <nav
      aria-label={messages.list.foldersLabel(rootName)}
      className="folder-tree"
    >
      <FolderButton
        depth={0}
        icon="library"
        name={rootName}
        onSelect={onSelect}
        onMove={onMove}
        onRename={onRename}
        onTrash={onTrash}
        path=""
        readOnly={readOnly}
        selectedPath={selectedPath}
      />
      <FolderChildren
        childrenByParent={children}
        collapsible={collapsible}
        depth={1}
        expandedPaths={expandedPaths}
        onSelect={onSelect}
        onMove={onMove}
        onRename={onRename}
        onTrash={onTrash}
        onToggleExpanded={onToggleExpanded}
        parent=""
        readOnly={readOnly}
        selectedPath={selectedPath}
      />
    </nav>
  );
}

type FolderChildrenProps = {
  readonly childrenByParent: ReadonlyMap<string, readonly FolderEntry[]>;
  readonly collapsible: boolean;
  readonly depth: number;
  readonly expandedPaths: ReadonlySet<string>;
  readonly onSelect: (path: string) => void;
  readonly onMove: (path: string, origin: HTMLElement) => void;
  readonly onRename: (path: string, origin: HTMLElement) => void;
  readonly onTrash: (path: string, origin: HTMLElement) => void;
  readonly onToggleExpanded?: (path: string) => void;
  readonly parent: string;
  readonly readOnly: boolean;
  readonly selectedPath: string;
};

function FolderChildren({
  childrenByParent,
  collapsible,
  depth,
  expandedPaths,
  onSelect,
  onMove,
  onRename,
  onTrash,
  onToggleExpanded,
  parent,
  readOnly,
  selectedPath,
}: FolderChildrenProps) {
  const children = childrenByParent.get(parent) ?? [];
  return children.map((folder) => {
    const hasChildren = (childrenByParent.get(folder.path)?.length ?? 0) > 0;
    const expanded = expandedPaths.has(folder.path);
    return (
      <div key={folder.path}>
        <FolderButton
          collapsible={collapsible}
          depth={depth}
          expanded={expanded}
          hasChildren={hasChildren}
          icon="folder"
          name={folder.name}
          onSelect={onSelect}
          onMove={onMove}
          onRename={onRename}
          onToggleExpanded={onToggleExpanded}
          onTrash={onTrash}
          path={folder.path}
          readOnly={readOnly}
          selectedPath={selectedPath}
        />
        {(!collapsible || expanded) && (
          <FolderChildren
            childrenByParent={childrenByParent}
            collapsible={collapsible}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            onSelect={onSelect}
            onMove={onMove}
            onRename={onRename}
            onToggleExpanded={onToggleExpanded}
            onTrash={onTrash}
            parent={folder.path}
            readOnly={readOnly}
            selectedPath={selectedPath}
          />
        )}
      </div>
    );
  });
}

type FolderButtonProps = {
  readonly collapsible?: boolean;
  readonly depth: number;
  readonly expanded?: boolean;
  readonly hasChildren?: boolean;
  readonly icon: "folder" | "library";
  readonly name: string;
  readonly onSelect: (path: string) => void;
  readonly onMove: (path: string, origin: HTMLElement) => void;
  readonly onRename: (path: string, origin: HTMLElement) => void;
  readonly onTrash: (path: string, origin: HTMLElement) => void;
  readonly onToggleExpanded?: (path: string) => void;
  readonly path: string;
  readonly readOnly: boolean;
  readonly selectedPath: string;
};

function FolderButton({
  collapsible = false,
  depth,
  expanded = false,
  hasChildren = false,
  icon,
  name,
  onSelect,
  onMove,
  onRename,
  onTrash,
  onToggleExpanded,
  path,
  readOnly,
  selectedPath,
}: FolderButtonProps) {
  const messages = useI18n();
  const Icon = icon === "library" ? Library : Folder;
  const selection = (
    triggerProps?: Parameters<Parameters<typeof ContextMenu>[0]["children"]>[0],
  ) => (
    <button
      aria-current={selectedPath === path ? "page" : undefined}
      className="folder-row"
      onClick={() => onSelect(path)}
      style={{
        paddingInlineStart: collapsible ? 0 : `${8 + depth * 14}px`,
      }}
      type="button"
      {...triggerProps}
    >
      {!collapsible && (
        <ChevronRight aria-hidden="true" className="folder-chevron" size={12} />
      )}
      <Icon aria-hidden="true" size={15} strokeWidth={1.7} />
      <span>{name}</span>
    </button>
  );
  const row = (
    triggerProps?: Parameters<Parameters<typeof ContextMenu>[0]["children"]>[0],
  ) =>
    collapsible ? (
      <div
        className="folder-row-group"
        style={{ paddingInlineStart: `${8 + depth * 14}px` }}
      >
        {hasChildren ? (
          <button
            aria-expanded={expanded}
            aria-label={name}
            className="folder-chevron-button"
            onClick={() => onToggleExpanded?.(path)}
            type="button"
          >
            <ChevronRight
              aria-hidden="true"
              className={
                expanded ? "folder-chevron expanded" : "folder-chevron"
              }
              size={12}
            />
          </button>
        ) : (
          <span aria-hidden="true" className="folder-chevron-spacer" />
        )}
        {selection(triggerProps)}
      </div>
    ) : (
      selection(triggerProps)
    );

  if (path === "" || readOnly) return row();

  return (
    <ContextMenu
      items={[
        {
          id: "rename",
          label: messages.menu.rename,
          onSelect: (origin) => onRename(path, origin),
        },
        {
          id: "move",
          label: messages.menu.move,
          onSelect: (origin) => onMove(path, origin),
        },
        {
          id: "trash",
          label: messages.menu.trash,
          danger: true,
          onSelect: (origin) => onTrash(path, origin),
        },
      ]}
      label={messages.list.actions(name)}
    >
      {row}
    </ContextMenu>
  );
}
