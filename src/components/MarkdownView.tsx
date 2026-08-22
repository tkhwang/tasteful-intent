import { Check, FileText, FolderTree, History } from "lucide-react";
import {
  type ImgHTMLAttributes,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { mapRawMatchesToRenderedText } from "@/lib/markdownTextOffsets";
import { readDocumentImage } from "@/lib/native";
import { formatCompactRootPath, joinRootPath } from "@/lib/rootDisplay";
import type { TextMatch } from "@/lib/textSearch";

const NO_FIND_MATCHES: readonly TextMatch[] = [];
const COPY_FEEDBACK_MS = 1500;

type MarkdownViewProps = {
  readonly body: string;
  readonly className?: string;
  readonly copyFileNameCopiedText?: string;
  readonly copyFileNameLabel?: string;
  readonly copyFileNameText?: string;
  readonly copyFilePathCopiedText?: string;
  readonly copyFilePathLabel?: string;
  readonly copyFilePathText?: string;
  readonly documentPath: string;
  readonly findActiveIndex?: number | null;
  readonly findMatches?: readonly TextMatch[];
  readonly root: string;
  readonly showPath?: boolean;
  readonly updatedLabel?: string;
  readonly updatedLocale?: string;
  readonly updatedMs?: number;
};

type CopyTarget = "name" | "path";

type PositionedNode = {
  children?: PositionedNode[];
  position?: {
    readonly end: { readonly offset?: number };
    readonly start: { readonly offset?: number };
  };
  properties?: Record<string, unknown>;
  tagName?: string;
  type: string;
  value?: string;
};

type MarkdownImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  readonly documentPath: string;
  readonly root: string;
};

function isLocalImageSource(source: string): boolean {
  return !/^[a-z][a-z\d+.-]*:/i.test(source) && !source.startsWith("//");
}

function createFindHighlighter(
  body: string,
  matches: readonly TextMatch[],
  activeIndex: number | null,
) {
  return () => (tree: unknown) => {
    const highlightNode = (node: PositionedNode) => {
      if (
        node.type === "text" &&
        node.value !== undefined &&
        node.position?.start.offset !== undefined &&
        node.position.end.offset !== undefined
      ) {
        const start = node.position.start.offset;
        const end = node.position.end.offset;
        const nodeMatches = mapRawMatchesToRenderedText(
          body,
          node.value,
          start,
          end,
          matches,
        );
        if (nodeMatches.length === 0) return;

        const children: PositionedNode[] = [];
        let from = 0;
        for (const match of nodeMatches) {
          const matchFrom = match.from;
          const matchTo = match.to;
          if (matchFrom > from) {
            children.push({
              type: "text",
              value: node.value.slice(from, matchFrom),
            });
          }
          children.push({
            children: [
              { type: "text", value: node.value.slice(matchFrom, matchTo) },
            ],
            properties: {
              className: [
                "document-find-match",
                ...(match.index === activeIndex ? ["is-active"] : []),
              ],
              dataFindMatchIndex: match.index,
            },
            tagName: "mark",
            type: "element",
          });
          from = matchTo;
        }
        if (from < node.value.length) {
          children.push({ type: "text", value: node.value.slice(from) });
        }

        node.type = "element";
        node.tagName = "span";
        node.properties = {};
        node.children = children;
        delete node.value;
        return;
      }

      for (const child of node.children ?? []) highlightNode(child);
    };

    highlightNode(tree as PositionedNode);
  };
}

function MarkdownImage({
  alt,
  documentPath,
  root,
  src,
  ...props
}: MarkdownImageProps) {
  const [resolvedSource, setResolvedSource] = useState<string | undefined>(
    () => (src && !isLocalImageSource(src) ? src : undefined),
  );

  useEffect(() => {
    if (!src || !isLocalImageSource(src)) {
      setResolvedSource(src);
      return;
    }

    let objectUrl: string | null = null;
    let cancelled = false;
    setResolvedSource(undefined);
    void readDocumentImage(root, documentPath, src)
      .then(({ bytes, mimeType }) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(
          new Blob([Uint8Array.from(bytes)], { type: mimeType }),
        );
        setResolvedSource(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setResolvedSource(undefined);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentPath, root, src]);

  return <img {...props} alt={alt ?? ""} src={resolvedSource} />;
}

export function MarkdownView({
  body,
  className,
  copyFileNameCopiedText = "File name copied to clipboard.",
  copyFileNameLabel = "Copy file name",
  copyFileNameText = "Name",
  copyFilePathCopiedText = "Full path including file name copied to clipboard.",
  copyFilePathLabel = "Copy full path including file name",
  copyFilePathText = "Full path",
  documentPath,
  findActiveIndex = null,
  findMatches = NO_FIND_MATCHES,
  root,
  showPath = false,
  updatedLabel = "File updated",
  updatedLocale = "en-US",
  updatedMs,
}: MarkdownViewProps) {
  const articleRef = useRef<HTMLElement>(null);
  const canonicalPath = joinRootPath(root, documentPath);
  const fileName = documentPath.split("/").at(-1) ?? documentPath;
  const updatedFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(updatedLocale, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    [updatedLocale],
  );
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const copyResetRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
    },
    [],
  );

  const copyToClipboard = (target: CopyTarget, text: string) => {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(target);
        if (copyResetRef.current !== null) {
          window.clearTimeout(copyResetRef.current);
        }
        copyResetRef.current = window.setTimeout(
          () => setCopied(null),
          COPY_FEEDBACK_MS,
        );
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (
      findActiveIndex === null ||
      findMatches[findActiveIndex] === undefined
    ) {
      return;
    }
    articleRef.current
      ?.querySelector<HTMLElement>(
        `[data-find-match-index="${findActiveIndex}"]`,
      )
      ?.scrollIntoView?.({ block: "center" });
  }, [findActiveIndex, findMatches]);

  // Memoized so an unrelated MarkdownView re-render (e.g. a sibling state
  // update elsewhere in the tree) does not hand react-markdown a new `img`
  // component identity, which would otherwise remount MarkdownImage and
  // drop any in-flight readDocumentImage load.
  const components = useMemo<Components>(
    () => ({
      img: ({ node: _node, ...props }) => (
        <MarkdownImage {...props} documentPath={documentPath} root={root} />
      ),
    }),
    [documentPath, root],
  );

  return (
    <article
      className={`markdown-view${className ? ` ${className}` : ""}`}
      ref={articleRef}
    >
      {showPath ? (
        <p className="document-path" title={canonicalPath}>
          <span>{formatCompactRootPath(canonicalPath)}</span>
          <button
            aria-label={copyFileNameLabel}
            className="document-path-copy"
            data-copied={copied === "name" || undefined}
            onClick={() => copyToClipboard("name", fileName)}
            title={copyFileNameLabel}
            type="button"
          >
            {copied === "name" ? (
              <Check aria-hidden="true" size={14} />
            ) : (
              <FileText aria-hidden="true" size={14} />
            )}
            <span>{copyFileNameText}</span>
          </button>
          <button
            aria-label={copyFilePathLabel}
            className="document-path-copy"
            data-copied={copied === "path" || undefined}
            onClick={() => copyToClipboard("path", canonicalPath)}
            title={copyFilePathLabel}
            type="button"
          >
            {copied === "path" ? (
              <Check aria-hidden="true" size={14} />
            ) : (
              <FolderTree aria-hidden="true" size={14} />
            )}
            <span>{copyFilePathText}</span>
          </button>
          {updatedMs !== undefined ? (
            <time
              className="document-path-updated"
              dateTime={new Date(updatedMs).toISOString()}
              title={updatedLabel}
            >
              <span className="sr-only">{updatedLabel}: </span>
              <History aria-hidden="true" size={12} />
              <span>{updatedFormatter.format(updatedMs)}</span>
            </time>
          ) : null}
          <span aria-atomic="true" aria-live="polite" className="sr-only">
            {copied === "name"
              ? copyFileNameCopiedText
              : copied === "path"
                ? copyFilePathCopiedText
                : ""}
          </span>
        </p>
      ) : null}
      <ReactMarkdown
        components={components}
        rehypePlugins={[
          createFindHighlighter(body, findMatches, findActiveIndex),
        ]}
        remarkPlugins={[remarkGfm]}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}
