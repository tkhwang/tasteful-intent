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
};

export function FolderTree({
  folders,
  rootName,
  selectedPath,
  onSelect,
  onMove,
  onRename,
  onTrash,
  readOnly = false,
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
        depth={1}
        onSelect={onSelect}
        onMove={onMove}
        onRename={onRename}
        onTrash={onTrash}
        parent=""
        readOnly={readOnly}
        selectedPath={selectedPath}
      />
    </nav>
  );
}

type FolderChildrenProps = {
  readonly childrenByParent: ReadonlyMap<string, readonly FolderEntry[]>;
  readonly depth: number;
  readonly onSelect: (path: string) => void;
  readonly onMove: (path: string, origin: HTMLElement) => void;
  readonly onRename: (path: string, origin: HTMLElement) => void;
  readonly onTrash: (path: string, origin: HTMLElement) => void;
  readonly parent: string;
  readonly readOnly: boolean;
  readonly selectedPath: string;
};

function FolderChildren({
  childrenByParent,
  depth,
  onSelect,
  onMove,
  onRename,
  onTrash,
  parent,
  readOnly,
  selectedPath,
}: FolderChildrenProps) {
  const children = childrenByParent.get(parent) ?? [];
  return children.map((folder) => (
    <div key={folder.path}>
      <FolderButton
        depth={depth}
        icon="folder"
        name={folder.name}
        onSelect={onSelect}
        onMove={onMove}
        onRename={onRename}
        onTrash={onTrash}
        path={folder.path}
        readOnly={readOnly}
        selectedPath={selectedPath}
      />
      <FolderChildren
        childrenByParent={childrenByParent}
        depth={depth + 1}
        onSelect={onSelect}
        onMove={onMove}
        onRename={onRename}
        onTrash={onTrash}
        parent={folder.path}
        readOnly={readOnly}
        selectedPath={selectedPath}
      />
    </div>
  ));
}

type FolderButtonProps = {
  readonly depth: number;
  readonly icon: "folder" | "library";
  readonly name: string;
  readonly onSelect: (path: string) => void;
  readonly onMove: (path: string, origin: HTMLElement) => void;
  readonly onRename: (path: string, origin: HTMLElement) => void;
  readonly onTrash: (path: string, origin: HTMLElement) => void;
  readonly path: string;
  readonly readOnly: boolean;
  readonly selectedPath: string;
};

function FolderButton({
  depth,
  icon,
  name,
  onSelect,
  onMove,
  onRename,
  onTrash,
  path,
  readOnly,
  selectedPath,
}: FolderButtonProps) {
  const messages = useI18n();
  const Icon = icon === "library" ? Library : Folder;
  const row = (
    triggerProps?: Parameters<Parameters<typeof ContextMenu>[0]["children"]>[0],
  ) => (
    <button
      aria-current={selectedPath === path ? "page" : undefined}
      className="folder-row"
      onClick={() => onSelect(path)}
      style={{ paddingInlineStart: `${8 + depth * 14}px` }}
      type="button"
      {...triggerProps}
    >
      <ChevronRight aria-hidden="true" className="folder-chevron" size={12} />
      <Icon aria-hidden="true" size={15} strokeWidth={1.7} />
      <span>{name}</span>
    </button>
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
