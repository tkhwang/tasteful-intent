import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { EditorState, type Range } from "@codemirror/state";
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightSpecialChars,
  keymap,
  ViewPlugin,
} from "@codemirror/view";
import { useCallback, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n";
import type { TextMatch } from "@/lib/textSearch";

const NO_FIND_MATCHES: readonly TextMatch[] = [];

type MarkdownEditorProps = {
  readonly documentKey: string;
  readonly findActiveIndex?: number | null;
  readonly findMatches?: readonly TextMatch[];
  readonly openDocumentKeys: readonly string[];
  readonly visible: boolean;
  readonly value: string;
  readonly onChange: (value: string) => void;
};

const markerNodes = new Set([
  "HeaderMark",
  "ListMark",
  "QuoteMark",
  "CodeMark",
  "HorizontalRule",
]);

export const markdownMarkerDecorations = ViewPlugin.fromClass(
  class {
    decorations;

    constructor(view: EditorView) {
      this.decorations = buildMarkerDecorations(view);
    }

    update(update: {
      readonly docChanged: boolean;
      readonly viewportChanged: boolean;
      readonly view: EditorView;
    }) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildMarkerDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

function buildMarkerDecorations(view: EditorView) {
  const ranges: Range<Decoration>[] = [];
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        if (
          markerNodes.has(node.name) &&
          node.from >= from &&
          node.to <= to &&
          node.from < node.to
        ) {
          ranges.push(
            Decoration.mark({ class: "cm-space-mark" }).range(
              node.from,
              node.to,
            ),
          );
        }
      },
    });
  }
  return Decoration.set(ranges, true);
}

export function MarkdownEditor({
  documentKey,
  findActiveIndex = null,
  findMatches = NO_FIND_MATCHES,
  openDocumentKeys,
  visible,
  value,
  onChange,
}: MarkdownEditorProps) {
  const messages = useI18n();
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const statesRef = useRef(new Map<string, EditorState>());
  const currentKeyRef = useRef(documentKey);
  const onChangeRef = useRef(onChange);
  const initialValueRef = useRef(value);
  const ariaLabelRef = useRef(messages.editor.body);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    ariaLabelRef.current = messages.editor.body;
    viewRef.current?.contentDOM.setAttribute(
      "aria-label",
      ariaLabelRef.current,
    );
  }, [messages.editor.body]);

  const createState = useCallback(
    (body: string) =>
      EditorState.create({
        doc: body,
        extensions: [
          highlightSpecialChars(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          markdown(),
          markdownMarkerDecorations,
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            "aria-label": ariaLabelRef.current,
            spellcheck: "true",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
        ],
      }),
    [],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const initialState = createState(initialValueRef.current);
    statesRef.current.set(currentKeyRef.current, initialState);
    const view = new EditorView({ parent: host, state: initialState });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
  }, [createState]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const switchState = () => {
      const currentKey = currentKeyRef.current;
      statesRef.current.set(currentKey, view.state);
      let next = statesRef.current.get(documentKey) ?? createState(value);
      if (next.doc.toString() !== value) {
        next = next.update({
          changes: { from: 0, to: next.doc.length, insert: value },
        }).state;
      }
      statesRef.current.set(documentKey, next);
      currentKeyRef.current = documentKey;
      view.setState(next);
      view.contentDOM.setAttribute("aria-label", ariaLabelRef.current);
    };

    if (view.composing) {
      view.contentDOM.addEventListener("compositionend", switchState, {
        once: true,
      });
      return () =>
        view.contentDOM.removeEventListener("compositionend", switchState);
    }
    switchState();
  }, [createState, documentKey, value]);

  useEffect(() => {
    const openKeys = new Set(openDocumentKeys);
    for (const key of statesRef.current.keys()) {
      if (!openKeys.has(key)) statesRef.current.delete(key);
    }
  }, [openDocumentKeys]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || findActiveIndex === null) return;
    if (
      currentKeyRef.current !== documentKey ||
      view.state.doc.toString() !== value
    ) {
      return;
    }
    const match = findMatches[findActiveIndex];
    if (!match) return;
    const canMeasureRange =
      typeof globalThis.Range !== "undefined" &&
      typeof globalThis.Range.prototype.getClientRects === "function";
    view.dispatch({
      ...(canMeasureRange
        ? { effects: EditorView.scrollIntoView(match.from, { y: "center" }) }
        : {}),
      selection: { anchor: match.from, head: match.to },
    });
  }, [documentKey, findActiveIndex, findMatches, value]);

  useEffect(() => {
    if (visible) viewRef.current?.requestMeasure();
  }, [visible]);

  return <div className="markdown-editor" ref={hostRef} />;
}
