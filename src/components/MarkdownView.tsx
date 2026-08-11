import {
  Children,
  cloneElement,
  type ImgHTMLAttributes,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readDocumentImage } from "@/lib/native";

type MarkdownViewProps = {
  readonly body: string;
  readonly className?: string;
  readonly documentPath: string;
  readonly findActiveIndex?: number | null;
  readonly findQuery?: string;
  readonly root: string;
};

type HighlightContext = {
  readonly activeIndex: number | null;
  index: number;
  readonly query: string;
};

type MarkdownImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  readonly documentPath: string;
  readonly root: string;
};

function isLocalImageSource(source: string): boolean {
  return !/^[a-z][a-z\d+.-]*:/i.test(source) && !source.startsWith("//");
}

function highlightText(node: ReactNode, context: HighlightContext): ReactNode {
  if (!context.query) return node;
  if (typeof node === "string") {
    const source = node.toLocaleLowerCase();
    const target = context.query.toLocaleLowerCase();
    const parts: ReactNode[] = [];
    let from = 0;
    while (from <= source.length - target.length) {
      const index = source.indexOf(target, from);
      if (index < 0) break;
      if (index > from) parts.push(node.slice(from, index));
      const matchIndex = context.index;
      context.index += 1;
      parts.push(
        <mark
          className={`document-find-match${matchIndex === context.activeIndex ? " is-active" : ""}`}
          data-find-match-index={matchIndex}
          key={`find-${matchIndex}`}
        >
          {node.slice(index, index + context.query.length)}
        </mark>,
      );
      from = index + Math.max(context.query.length, 1);
    }
    if (parts.length === 0) return node;
    if (from < node.length) parts.push(node.slice(from));
    return parts;
  }
  if (isValidElement(node)) {
    if (node.type === "mark") return node;
    const element = node as ReactElement<{ readonly children?: ReactNode }>;
    if (element.props.children === undefined) return node;
    return cloneElement(
      element,
      undefined,
      highlightText(element.props.children, context),
    );
  }
  return Children.map(node, (child) => highlightText(child, context));
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
  findQuery = "",
  root,
}: MarkdownViewProps) {
  const articleRef = useRef<HTMLElement>(null);
  const highlightContext: HighlightContext = {
    activeIndex: findActiveIndex,
    index: 0,
    query: findQuery,
  };

  useEffect(() => {
    if (!findQuery || findActiveIndex === null) return;
    articleRef.current
      ?.querySelector<HTMLElement>(
        `[data-find-match-index="${findActiveIndex}"]`,
      )
      ?.scrollIntoView?.({ block: "center" });
  }, [findActiveIndex, findQuery]);

  return (
    <article
      className={`markdown-view${className ? ` ${className}` : ""}`}
      ref={articleRef}
    >
      <ReactMarkdown
        components={{
          blockquote: ({ node: _node, children, ...props }) => (
            <blockquote {...props}>
              {highlightText(children, highlightContext)}
            </blockquote>
          ),
          code: ({ node: _node, children, ...props }) => (
            <code {...props}>{highlightText(children, highlightContext)}</code>
          ),
          h1: ({ node: _node, children, ...props }) => (
            <h1 {...props}>{highlightText(children, highlightContext)}</h1>
          ),
          h2: ({ node: _node, children, ...props }) => (
            <h2 {...props}>{highlightText(children, highlightContext)}</h2>
          ),
          h3: ({ node: _node, children, ...props }) => (
            <h3 {...props}>{highlightText(children, highlightContext)}</h3>
          ),
          h4: ({ node: _node, children, ...props }) => (
            <h4 {...props}>{highlightText(children, highlightContext)}</h4>
          ),
          h5: ({ node: _node, children, ...props }) => (
            <h5 {...props}>{highlightText(children, highlightContext)}</h5>
          ),
          h6: ({ node: _node, children, ...props }) => (
            <h6 {...props}>{highlightText(children, highlightContext)}</h6>
          ),
          img: ({ node: _node, ...props }) => (
            <MarkdownImage {...props} documentPath={documentPath} root={root} />
          ),
          li: ({ node: _node, children, ...props }) => (
            <li {...props}>{highlightText(children, highlightContext)}</li>
          ),
          p: ({ node: _node, children, ...props }) => (
            <p {...props}>{highlightText(children, highlightContext)}</p>
          ),
          td: ({ node: _node, children, ...props }) => (
            <td {...props}>{highlightText(children, highlightContext)}</td>
          ),
          th: ({ node: _node, children, ...props }) => (
            <th {...props}>{highlightText(children, highlightContext)}</th>
          ),
        }}
        remarkPlugins={[remarkGfm]}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}
