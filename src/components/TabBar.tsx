import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceDocument } from "@/hooks/useLibraryWorkspace";
import { useI18n } from "@/lib/i18n";

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
  return (
    <div className="tab-bar">
      <div className="tab-bar-leading">{leadingAction}</div>
      <div aria-label={messages.tabs.label} className="tab-list" role="tablist">
        {documents.map((document) => {
          const identity = getDocumentIdentity(document);
          const active = activePath === identity;
          const parent = document.path.split("/").slice(0, -1).join("/");
          const rootName =
            document.root.split("/").filter(Boolean).at(-1) ?? document.root;
          const fullPath = `${document.root}/${document.path}`;
          return (
            <div
              className={`tab-item ${docsMode ? "docs-tab" : ""} ${active ? "active" : ""}`}
              key={identity}
              role="presentation"
            >
              <button
                aria-label={
                  docsMode ? `${document.title}, ${fullPath}` : undefined
                }
                aria-selected={active}
                className="tab-select"
                onClick={() => onSelect(identity)}
                role="tab"
                title={docsMode ? fullPath : document.path}
                type="button"
              >
                <span className="tab-copy">
                  <span className="tab-title">{document.title}</span>
                  {docsMode ? (
                    <small className="tab-path">
                      {parent ? `${rootName} / ${parent}` : rootName}
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
