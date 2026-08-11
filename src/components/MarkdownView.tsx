import { type ImgHTMLAttributes, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readDocumentImage } from "@/lib/native";
import type { TextMatch } from "@/lib/textSearch";

const NO_FIND_MATCHES: readonly TextMatch[] = [];

type MarkdownViewProps = {
  readonly body: string;
  readonly className?: string;
  readonly documentPath: string;
  readonly findActiveIndex?: number | null;
  readonly findMatches?: readonly TextMatch[];
  readonly root: string;
};

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
        const nodeMatches = matches
          .map((match, index) => ({ ...match, index }))
          .filter((match) => match.from >= start && match.to <= end);
        if (nodeMatches.length === 0) return;

        const children: PositionedNode[] = [];
        let from = 0;
        for (const match of nodeMatches) {
          const matchFrom = match.from - start;
          const matchTo = match.to - start;
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
  documentPath,
  findActiveIndex = null,
  findMatches = NO_FIND_MATCHES,
  root,
}: MarkdownViewProps) {
  const articleRef = useRef<HTMLElement>(null);

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

  return (
    <article
      className={`markdown-view${className ? ` ${className}` : ""}`}
      ref={articleRef}
    >
      <ReactMarkdown
        components={{
          img: ({ node: _node, ...props }) => (
            <MarkdownImage {...props} documentPath={documentPath} root={root} />
          ),
        }}
        rehypePlugins={[createFindHighlighter(findMatches, findActiveIndex)]}
        remarkPlugins={[remarkGfm]}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}
