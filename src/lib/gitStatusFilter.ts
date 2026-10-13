import type { DocumentEntry, LibrarySnapshot } from "@/types/library";

export const GIT_FILTERS = ["all", "modified", "new"] as const;
export type GitFilter = (typeof GIT_FILTERS)[number];

export type GitStatusPaths = {
  readonly modifiedPaths: readonly string[];
  readonly newPaths: readonly string[];
};

export type DocumentFilter = (path: string) => boolean;

export const matchNoDocument: DocumentFilter = () => false;

/**
 * A `new` path ending in `/` is an untracked nested repository, which git
 * reports as one directory entry covering every document below it.
 */
export function createGitDocumentFilter(
  status: GitStatusPaths,
  filter: Exclude<GitFilter, "all">,
): DocumentFilter {
  const paths = filter === "modified" ? status.modifiedPaths : status.newPaths;
  const exact = new Set(paths.filter((path) => !path.endsWith("/")));
  const prefixes = paths.filter((path) => path.endsWith("/"));
  return (path) =>
    exact.has(path) || prefixes.some((prefix) => path.startsWith(prefix));
}

/** Keeps matching documents and only the folders on their ancestor chains. */
export function filterSnapshot(
  snapshot: LibrarySnapshot,
  matches: DocumentFilter,
): LibrarySnapshot {
  const documents = snapshot.documents.filter((document) =>
    matches(document.path),
  );
  const branches = new Set<string>();
  for (const document of documents) {
    let folder = document.parent;
    while (folder !== "" && !branches.has(folder)) {
      branches.add(folder);
      folder = folder.split("/").slice(0, -1).join("/");
    }
  }
  return {
    documents,
    folders: snapshot.folders.filter((folder) => branches.has(folder.path)),
  };
}

export function isWithinFolder(path: string, folder: string): boolean {
  return folder === "" || path === folder || path.startsWith(`${folder}/`);
}

/** The document's parent relative to `folder`; empty when directly inside it. */
export function relativeParent(
  document: DocumentEntry,
  folder: string,
): string {
  if (document.parent === folder) return "";
  return folder === ""
    ? document.parent
    : document.parent.slice(folder.length + 1);
}
