import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceDocument } from "@/hooks/useLibraryWorkspace";
import { createDocumentShortcutLabeler } from "@/lib/documentShortcutLabel";
import { useI18n } from "@/lib/i18n";

function formatParentPath(root: string, path: string): string {
  const rootBasename = root.split("/").filter(Boolean).at(-1);
  const parentSegments = path.split("/").slice(0, -1).filter(Boolean).slice(-2);
  return `.../${[rootBasename, ...parentSegments].filter(Boolean).join("/")}`;
}

type TabBarProps = {
  readonly activePath: string | null;
  readonly docsMode?: boolean;
  readonly documents: readonly WorkspaceDocument[];
  readonly getDocumentIdentity?: (document: WorkspaceDocument) => string;
  readonly leadingAction: ReactNode;
  readonly onClose: (path: string) => Promise<void>;
  readonly onSelect: (path: string) => void;
  readonly trailingActions: ReactNode;
};

export function TabBar({
  activePath,
  docsMode = false,
  documents,
  getDocumentIdentity = (document) => document.path,
  leadingAction,
  onClose,
  onSelect,
  trailingActions,
}: TabBarProps) {
  const messages = useI18n();
  const getSourceLabel = createDocumentShortcutLabeler(
    documents.map((document) => document.root),
  );
  return (
    <div
      className={`tab-bar${docsMode && documents.length > 0 ? " has-docs-tab" : ""}`}
    >
      <div className="tab-bar-leading">{leadingAction}</div>
      <div aria-label={messages.tabs.label} className="tab-list" role="tablist">
        {documents.map((document) => {
          const identity = getDocumentIdentity(document);
          const active = activePath === identity;
          const fullPath = `${document.root}/${document.path}`;
          const sourceLabel = getSourceLabel(document.root);
          return (
            <div
              className={`tab-item ${docsMode ? "docs-tab" : ""} ${active ? "active" : ""}`}
              key={identity}
              role="presentation"
            >
              <button
                aria-label={
                  docsMode
                    ? `${sourceLabel}, ${document.title}, ${fullPath}`
                    : undefined
                }
                aria-selected={active}
                className="tab-select"
                onClick={() => onSelect(identity)}
                role="tab"
                title={docsMode ? fullPath : document.path}
                type="button"
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
                    <span className="sr-only">{messages.tabs.saveFailed}</span>
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
          );
        })}
      </div>
      <div className="tab-bar-actions">{trailingActions}</div>
    </div>
  );
}
