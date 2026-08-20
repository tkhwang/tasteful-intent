import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { ContextMenuItem } from "@/components/ContextMenu";
import { ContextMenu } from "@/components/ContextMenu";
import type { WorkspaceDocument } from "@/hooks/useLibraryWorkspace";
import { createDocumentShortcutLabeler } from "@/lib/documentShortcutLabel";
import { useI18n } from "@/lib/i18n";
import { joinRootPath } from "@/lib/rootDisplay";

function formatParentPath(root: string, path: string): string {
  const rootBasename = root.split("/").filter(Boolean).at(-1);
  const parentSegments = path.split("/").slice(0, -1).filter(Boolean).slice(-2);
  return `.../${[rootBasename, ...parentSegments].filter(Boolean).join("/")}`;
}

type TabBarProps = {
  readonly activePath: string | null;
  readonly docsMode?: boolean;
  readonly documents: readonly WorkspaceDocument[];
  readonly fullPathLabels?: boolean;
  readonly getDocumentIdentity?: (document: WorkspaceDocument) => string;
  readonly leadingAction: ReactNode;
  readonly onClose: (path: string) => Promise<void>;
  readonly onCloseMany: (paths: readonly string[]) => Promise<void>;
  readonly onSelect: (path: string) => void;
  readonly trailingActions: ReactNode;
};

export function TabBar({
  activePath,
  docsMode = false,
  documents,
  fullPathLabels = false,
  getDocumentIdentity = (document) => document.path,
  leadingAction,
  onClose,
  onCloseMany,
  onSelect,
  trailingActions,
}: TabBarProps) {
  const messages = useI18n();
  const getSourceLabel = createDocumentShortcutLabeler(
    documents.map((document) => document.root),
  );
  const identities = documents.map(getDocumentIdentity);
  return (
    <div
      className={`tab-bar${docsMode && documents.length > 0 ? " has-docs-tab" : ""}`}
    >
      <div className="tab-bar-leading">{leadingAction}</div>
      <div aria-label={messages.tabs.label} className="tab-list" role="tablist">
        {documents.map((document, index) => {
          const identity = getDocumentIdentity(document);
          const active = activePath === identity;
          const fullPath = joinRootPath(document.root, document.path);
          const sourceLabel = getSourceLabel(document.root);
          const others = identities.filter((_, other) => other !== index);
          const toTheRight = identities.slice(index + 1);
          const menuItems: ContextMenuItem[] = [
            {
              id: "close",
              label: messages.tabs.closeTab,
              onSelect: () => void onClose(identity),
            },
            ...(others.length > 0
              ? [
                  {
                    id: "close-others",
                    label: messages.tabs.closeOthers,
                    onSelect: () => void onCloseMany(others),
                  },
                ]
              : []),
            ...(toTheRight.length > 0
              ? [
                  {
                    id: "close-to-the-right",
                    label: messages.tabs.closeToTheRight,
                    onSelect: () => void onCloseMany(toTheRight),
                  },
                ]
              : []),
            {
              id: "close-all",
              label: messages.tabs.closeAll,
              onSelect: () => void onCloseMany(identities),
            },
          ];
          return (
            <ContextMenu
              items={menuItems}
              key={identity}
              label={messages.tabs.actions(document.title)}
            >
              {(triggerProps) => (
                <div
                  className={`tab-item ${docsMode ? "docs-tab" : ""} ${active ? "active" : ""}`}
                  role="presentation"
                >
                  <button
                    aria-label={
                      docsMode
                        ? `${sourceLabel}, ${document.title}, ${fullPath}`
                        : fullPathLabels
                          ? `${document.title}, ${fullPath}`
                          : undefined
                    }
                    aria-selected={active}
                    className="tab-select"
                    onClick={() => onSelect(identity)}
                    role="tab"
                    title={
                      docsMode || fullPathLabels ? fullPath : document.path
                    }
                    type="button"
                    {...triggerProps}
                  >
                    <span className="tab-copy">
                      <span className="tab-title-row">
                        {docsMode ? (
                          <span aria-hidden="true" className="tab-source-label">
                            {sourceLabel}
                          </span>
                        ) : null}
                        <span className="tab-title">{document.title}</span>
                      </span>
                      {docsMode ? (
                        <small className="tab-path">
                          {formatParentPath(document.root, document.path)}
                        </small>
                      ) : null}
                    </span>
                    {document.saveStatus === "dirty" ||
                    document.saveStatus === "saving" ? (
                      <>
                        <span aria-hidden="true" className="tab-dirty" />
                        <span className="sr-only">{messages.tabs.unsaved}</span>
                      </>
                    ) : null}
                    {document.saveStatus === "error" ? (
                      <>
                        <span aria-hidden="true" className="tab-error">
                          !
                        </span>
                        <span className="sr-only">
                          {messages.tabs.saveFailed}
                        </span>
                      </>
                    ) : null}
                  </button>
                  <button
                    aria-label={messages.tabs.close(document.title)}
                    className="tab-close"
                    onClick={() => void onClose(identity)}
                    type="button"
                  >
                    <X aria-hidden="true" size={13} />
                  </button>
                </div>
              )}
            </ContextMenu>
          );
        })}
      </div>
      <div className="tab-bar-actions">{trailingActions}</div>
    </div>
  );
}
