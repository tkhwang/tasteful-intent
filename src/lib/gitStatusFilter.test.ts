import { describe, expect, it } from "vitest";
import {
  createGitDocumentFilter,
  filterSnapshot,
  isWithinFolder,
  relativeParent,
} from "./gitStatusFilter";

const status = {
  modifiedPaths: ["notes/edited.md"],
  newPaths: ["draft.md", "vendor/"],
};

describe("createGitDocumentFilter", () => {
  it("matches only the requested bucket", () => {
    const modified = createGitDocumentFilter(status, "modified");
    const added = createGitDocumentFilter(status, "new");

    expect(modified("notes/edited.md")).toBe(true);
    expect(modified("draft.md")).toBe(false);
    expect(added("draft.md")).toBe(true);
    expect(added("notes/edited.md")).toBe(false);
  });

  it("matches modified and new documents together for changed", () => {
    const changed = createGitDocumentFilter(status, "changed");

    expect(changed("notes/edited.md")).toBe(true);
    expect(changed("draft.md")).toBe(true);
    expect(changed("vendor/readme.md")).toBe(true);
    expect(changed("notes/clean.md")).toBe(false);
  });

  it("treats a directory entry as covering every document below it", () => {
    const added = createGitDocumentFilter(status, "new");

    expect(added("vendor/readme.md")).toBe(true);
    expect(added("vendor/deep/guide.md")).toBe(true);
    expect(added("vendor-notes.md")).toBe(false);
  });
});

describe("filterSnapshot", () => {
  it("keeps matching documents and only the folders on their ancestor chains", () => {
    const snapshot = {
      folders: [
        { path: "a", parent: "", name: "a" },
        { path: "a/b", parent: "a", name: "b" },
        { path: "a/b/c", parent: "a/b", name: "c" },
        { path: "a/other", parent: "a", name: "other" },
        { path: "z", parent: "", name: "z" },
      ],
      documents: [
        { path: "a/b/c/hit.md", parent: "a/b/c", title: "hit", updatedMs: 2 },
        {
          path: "a/other/miss.md",
          parent: "a/other",
          title: "miss",
          updatedMs: 1,
        },
        { path: "top.md", parent: "", title: "top", updatedMs: 1 },
      ],
    };

    const filtered = filterSnapshot(
      snapshot,
      (path) => path === "a/b/c/hit.md" || path === "top.md",
    );

    expect(filtered.documents.map(({ path }) => path)).toEqual([
      "a/b/c/hit.md",
      "top.md",
    ]);
    expect(filtered.folders.map(({ path }) => path)).toEqual([
      "a",
      "a/b",
      "a/b/c",
    ]);
  });
});

describe("folder helpers", () => {
  it("scopes documents to a folder subtree with the root covering everything", () => {
    expect(isWithinFolder("a/b", "")).toBe(true);
    expect(isWithinFolder("a/b", "a")).toBe(true);
    expect(isWithinFolder("a", "a")).toBe(true);
    expect(isWithinFolder("ab", "a")).toBe(false);
  });

  it("shows the parent relative to the selected folder", () => {
    const document = {
      path: "a/b/c/note.md",
      parent: "a/b/c",
      title: "note",
      updatedMs: 1,
    };

    expect(relativeParent(document, "")).toBe("a/b/c");
    expect(relativeParent(document, "a")).toBe("b/c");
    expect(relativeParent(document, "a/b/c")).toBe("");
  });
});
