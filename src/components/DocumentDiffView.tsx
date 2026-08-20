import { markdown } from "@codemirror/lang-markdown";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { unifiedMergeView } from "@codemirror/merge";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";

// `@codemirror/merge` defaults to `{margin: 3, minSize: 4}`, which only folds
// an unchanged run once it survives both margins — 10+ consecutive unchanged
// lines between chunks. Real memos rarely clear that bar, so `changes` and
// `full` rendered identically and the toggle looked broken. At `{2, 2}` a run
// of 6 folds (4 at the document's head or tail) while each change still keeps
// two lines of context.
const CHANGES_COLLAPSE = { margin: 2, minSize: 2 } as const;

type DocumentDiffViewProps = {
  readonly baseline: string;
  readonly body: string;
  readonly cleanLabel: string;
  readonly variant: "changes" | "full";
};

export function DocumentDiffView({
  baseline,
  body,
  cleanLabel,
  variant,
}: DocumentDiffViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const clean = baseline === body;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || clean) return;
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: body,
        extensions: [
          EditorState.readOnly.of(true),
          EditorView.editable.of(false),
          EditorView.lineWrapping,
          markdown(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          unifiedMergeView({
            ...(variant === "changes"
              ? { collapseUnchanged: CHANGES_COLLAPSE }
              : {}),
            mergeControls: false,
            original: baseline,
          }),
        ],
      }),
    });
    return () => {
      view.destroy();
    };
  }, [baseline, body, clean, variant]);

  if (clean) {
    return (
      <div className="document-diff-view is-clean">
        <p>{cleanLabel}</p>
      </div>
    );
  }
  return <div className="document-diff-view" ref={hostRef} />;
}
