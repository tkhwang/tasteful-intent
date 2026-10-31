import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import {
  Annotation,
  type ChangeSpec,
  EditorState,
  type Range,
  type StateEffect,
} from "@codemirror/state";
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
// Edits the parent has not echoed back through `value` yet. Bounded in case a
// parent never echoes.
const MAX_PENDING_ECHOES = 32;
// Marks a body that came from the parent so it is not reported back as an edit.
const fromParent = Annotation.define<boolean>();

type ScrollRestore = StateEffect<unknown> | "top";

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

// The smallest single replacement that turns `before` into `after`, so the
// caret and scroll anchor outside the changed range keep their place.
function changeBetween(before: string, after: string): ChangeSpec {
  const shorter = Math.min(before.length, after.length);
  let start = 0;
  while (
    start < shorter &&
    before.charCodeAt(start) === after.charCodeAt(start)
  ) {
    start += 1;
  }
  let beforeEnd = before.length;
  let afterEnd = after.length;
  while (
    beforeEnd > start &&
    afterEnd > start &&
    before.charCodeAt(beforeEnd - 1) === after.charCodeAt(afterEnd - 1)
  ) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }
  return { from: start, to: beforeEnd, insert: after.slice(start, afterEnd) };
}

// A hidden editor (View mode) has no layout to read or scroll.
function isLaidOut(view: EditorView) {
  return view.scrollDOM.clientHeight > 0;
}

// Returns focus to `element` without scrolling. An editor needs its own focus
// call: focusing its content element directly makes the browser move the caret
// to the top of the document.
export function restoreFocus(element: HTMLElement) {
  const editor = element.closest<HTMLElement>(".cm-editor");
  const view = editor ? EditorView.findFromDOM(editor) : null;
  if (view) view.focus();
  else element.focus({ preventScroll: true });
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
  const scrollsRef = useRef(new Map<string, StateEffect<unknown>>());
  const pendingScrollRef = useRef<ScrollRestore | null>(null);
  const pendingEchoesRef = useRef<string[]>([]);
  // Whether the editor was on screen as of the previous render.
  const shownRef = useRef(visible);
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
            if (
              !update.docChanged ||
              update.transactions.some((tr) => tr.annotation(fromParent))
            ) {
              return;
            }
            const text = update.state.doc.toString();
            const echoes = pendingEchoesRef.current;
            echoes.push(text);
            if (echoes.length > MAX_PENDING_ECHOES) echoes.shift();
            onChangeRef.current(text);
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
    // Track each document's position while it is on screen; once the editor
    // is hidden (View mode) its scroll position can no longer be read.
    const rememberScroll = () => {
      if (!isLaidOut(view)) return;
      scrollsRef.current.set(currentKeyRef.current, view.scrollSnapshot());
    };
    view.scrollDOM.addEventListener("scroll", rememberScroll, {
      passive: true,
    });
    return () => {
      view.scrollDOM.removeEventListener("scroll", rememberScroll);
      viewRef.current = null;
      view.destroy();
    };
  }, [createState]);

  const restorePendingScroll = useCallback((view: EditorView) => {
    const restore = pendingScrollRef.current;
    if (!restore || !isLaidOut(view)) return;
    pendingScrollRef.current = null;
    if (restore === "top") {
      view.scrollDOM.scrollTop = 0;
      view.scrollDOM.scrollLeft = 0;
    } else {
      view.dispatch({ effects: restore });
    }
  }, []);

  const switchDocument = useCallback(
    (view: EditorView, key: string, body: string) => {
      // Read the outgoing position directly when the editor has stayed on
      // screen; otherwise keep the one tracked from scroll events.
      if (shownRef.current && isLaidOut(view)) {
        scrollsRef.current.set(currentKeyRef.current, view.scrollSnapshot());
      }
      statesRef.current.set(currentKeyRef.current, view.state);
      let next = statesRef.current.get(key) ?? createState(body);
      let scroll = scrollsRef.current.get(key);
      const cached = next.doc.toString();
      if (cached !== body) {
        const changes = next.changes(changeBetween(cached, body));
        next = next.update({ changes }).state;
        scroll = scroll?.map(changes);
      }
      statesRef.current.set(key, next);
      currentKeyRef.current = key;
      pendingEchoesRef.current = [];
      // `setState` rebuilds the view from scratch, so it is only for switching
      // documents; it also forgets the scroll position, which is restored here.
      view.setState(next);
      view.contentDOM.setAttribute("aria-label", ariaLabelRef.current);
      pendingScrollRef.current = scroll ?? "top";
      restorePendingScroll(view);
    },
    [createState, restorePendingScroll],
  );

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const sync = () => {
      if (currentKeyRef.current !== documentKey) {
        switchDocument(view, documentKey, value);
        return;
      }
      // Every edit comes back as `value`. An older echo can still land after a
      // newer edit, and neither needs any work.
      const echoes = pendingEchoesRef.current;
      const echo = echoes.lastIndexOf(value);
      if (echo >= 0) {
        echoes.splice(0, echo + 1);
        return;
      }
      const current = view.state.doc.toString();
      if (current === value) return;
      // The body changed outside the editor, such as a reload from disk.
      // Update the open view in place so the caret and scroll position stay.
      pendingEchoesRef.current = [];
      view.dispatch({
        changes: changeBetween(current, value),
        annotations: fromParent.of(true),
      });
    };

    if (view.composing) {
      view.contentDOM.addEventListener("compositionend", sync, { once: true });
      return () => view.contentDOM.removeEventListener("compositionend", sync);
    }
    sync();
  }, [documentKey, switchDocument, value]);

  useEffect(() => {
    const openKeys = new Set(openDocumentKeys);
    for (const key of statesRef.current.keys()) {
      if (!openKeys.has(key)) statesRef.current.delete(key);
    }
    for (const key of scrollsRef.current.keys()) {
      if (!openKeys.has(key)) scrollsRef.current.delete(key);
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
    shownRef.current = visible;
    const view = viewRef.current;
    if (!view || !visible) return;
    restorePendingScroll(view);
    view.requestMeasure();
  }, [restorePendingScroll, visible]);

  return <div className="markdown-editor" ref={hostRef} />;
}
