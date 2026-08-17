import { describe, expect, it } from "vitest";
import { formatCompactRootPath, formatRootDisplay } from "@/lib/rootDisplay";

describe("formatRootDisplay", () => {
  it("collapses a deep path to its final parent and leaf", () => {
    expect(
      formatRootDisplay("/Users/x/dev/side-projects/claude-outputs"),
    ).toEqual({ parent: "…/side-projects/", leaf: "claude-outputs" });
  });

  it("keeps a two-level path intact", () => {
    expect(formatRootDisplay("/memo/intents")).toEqual({
      parent: "/memo/",
      leaf: "intents",
    });
  });

  it("keeps only the filesystem root for a one-level path", () => {
    expect(formatRootDisplay("/intents")).toEqual({
      parent: "/",
      leaf: "intents",
    });
  });

  it("does not duplicate the filesystem root slash", () => {
    expect(formatRootDisplay("/")).toEqual({ parent: "", leaf: "/" });
  });
});

describe("formatCompactRootPath", () => {
  it("shows the last two path segments behind a leading ellipsis", () => {
    // Given: a canonical root has more than two segments.
    const root = "/Users/example/aaa/bbb";

    // When: the root is formatted for the compact AI path list.
    const display = formatCompactRootPath(root);

    // Then: only the final two segments stay visible.
    expect(display).toBe("…/aaa/bbb");
  });

  it("keeps the ellipsis for a two-segment absolute path", () => {
    // Given: a canonical root has exactly two segments.
    const root = "/work/a";

    // When: the root is formatted for the compact AI path list.
    const display = formatCompactRootPath(root);

    // Then: the compact form still communicates omitted leading context.
    expect(display).toBe("…/work/a");
  });
});
