import { FolderPlus, X } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { formatRootDisplay } from "@/lib/rootDisplay";

type DocsRootSwitcherProps = {
  readonly roots: readonly string[];
  readonly activeRoot: string;
  readonly leadingControl?: ReactNode;
  readonly onOpenFolder: () => void;
  readonly onSelect: (root: string) => Promise<boolean>;
  readonly onClose: (root: string) => Promise<boolean>;
};

export function DocsRootSwitcher({
  roots,
  activeRoot,
  leadingControl,
  onOpenFolder,
  onSelect,
  onClose,
}: DocsRootSwitcherProps) {
  const messages = useI18n();
  const selectRoot = async (root: string) => {
    try {
      await onSelect(root);
    } catch (cause) {
      reportError(cause);
    }
  };
  const closeRoot = async (root: string) => {
    try {
      await onClose(root);
    } catch (cause) {
      reportError(cause);
    }
  };

  return (
    <div className="docs-root-switcher source-card">
      <fieldset className="docs-root-shortcuts">
        <legend className="sr-only">
          {messages.docsSourceModes.selectorLabel}
        </legend>
        {leadingControl}
        <button
          aria-label={messages.app.chooseDocsRoot}
          className="docs-root-open"
          onClick={onOpenFolder}
          title={messages.app.chooseDocsRoot}
          type="button"
        >
          <FolderPlus aria-hidden="true" size={15} />
        </button>
      </fieldset>
      <div
        aria-label={messages.docsSourceModes.browseFolders}
        className="browse-root-tabs"
        role="toolbar"
      >
        {roots.map((root) => {
          const display = formatRootDisplay(root);
          return (
            <div className="browse-root-tab" key={root}>
              <button
                aria-label={messages.docsSourceModes.openBrowseFolder(root)}
                aria-pressed={root === activeRoot}
                className="browse-root-tab-select"
                onClick={() => void selectRoot(root)}
                title={root}
                type="button"
              >
                <small>{display.parent}</small>
                <span>{display.leaf}</span>
              </button>
              <button
                aria-label={messages.docsSourceModes.closeBrowseFolder(root)}
                className="browse-root-tab-close"
                onClick={() => void closeRoot(root)}
                title={messages.docsSourceModes.closeBrowseFolder(root)}
                type="button"
              >
                <X aria-hidden="true" size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
