import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceDocument } from "@/hooks/useLibraryWorkspace";
import { useI18n } from "@/lib/i18n";

type TabBarProps = {
  readonly activePath: string | null;
  readonly documents: readonly WorkspaceDocument[];
  readonly leadingAction: ReactNode;
  readonly onClose: (path: string) => Promise<void>;
  readonly onSelect: (path: string) => void;
  readonly trailingActions: ReactNode;
};

export function TabBar({
  activePath,
  documents,
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
        {documents.map((document) => (
          <div
            className={`tab-item ${activePath === document.path ? "active" : ""}`}
            key={document.path}
            role="presentation"
          >
            <button
              aria-selected={activePath === document.path}
              className="tab-select"
              onClick={() => onSelect(document.path)}
              role="tab"
              title={document.path}
              type="button"
            >
              <span>{document.title}</span>
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
              onClick={() => void onClose(document.path)}
              type="button"
            >
              <X aria-hidden="true" size={13} />
            </button>
          </div>
        ))}
      </div>
      <div className="tab-bar-actions">{trailingActions}</div>
    </div>
  );
}
