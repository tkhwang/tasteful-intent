import { FolderPlus } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";

type DocsRootSwitcherProps = {
  readonly root: string;
  readonly leadingControl?: ReactNode;
  readonly onOpenFolder: () => void;
};

export function DocsRootSwitcher({
  root,
  leadingControl,
  onOpenFolder,
}: DocsRootSwitcherProps) {
  const messages = useI18n();

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
      <button
        aria-label={`${messages.app.chooseDocsRoot}: ${root}`}
        className="docs-root-current"
        onClick={onOpenFolder}
        title={root}
        type="button"
      >
        <span className="docs-root-current-path">{root}</span>
      </button>
    </div>
  );
}
