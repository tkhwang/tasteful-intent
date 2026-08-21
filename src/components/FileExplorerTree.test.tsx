// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileExplorerTree } from "./FileExplorerTree";

const folders = [
  { path: "docs", parent: "", name: "docs" },
  { path: "docs/plans", parent: "docs", name: "plans" },
];
const documents = [
  { path: "README.md", parent: "", title: "README", updatedMs: 1 },
  { path: "docs/spec.md", parent: "docs", title: "spec", updatedMs: 2 },
  {
    path: "docs/plans/plan.md",
    parent: "docs/plans",
    title: "plan",
    updatedMs: 3,
  },
];

afterEach(cleanup);

describe("FileExplorerTree", () => {
  it("renders a labeled root and mixes direct files with expandable folders", async () => {
    const user = userEvent.setup();
    const onSelectFolder = vi.fn();
    const onToggleFolder = vi.fn();
    const onOpenDocument = vi.fn();
    render(
      <FileExplorerTree
        activePath={null}
        documents={documents}
        expandedPaths={new Set(["docs"])}
        folders={folders}
        onOpenDocument={onOpenDocument}
        onSelectFolder={onSelectFolder}
        onToggleFolder={onToggleFolder}
        rootLabel="T1"
        rootName="task-one"
        selectedFolder="docs"
      />,
    );

    expect(screen.getByRole("button", { name: "[T1] task-one" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "README" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "spec" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "plan" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "plans" }));
    expect(onSelectFolder).toHaveBeenCalledWith("docs/plans");
    expect(onToggleFolder).toHaveBeenCalledWith("docs/plans");

    await user.click(screen.getByRole("button", { name: "spec" }));
    expect(onOpenDocument).toHaveBeenCalledWith("docs/spec.md");
  });

  it("lists folders before files at each level", () => {
    render(
      <FileExplorerTree
        activePath={null}
        documents={[
          { path: "alpha.md", parent: "", title: "alpha", updatedMs: 1 },
        ]}
        expandedPaths={new Set()}
        folders={[{ path: "zeta", parent: "", name: "zeta" }]}
        onOpenDocument={vi.fn()}
        onSelectFolder={vi.fn()}
        onToggleFolder={vi.fn()}
        rootName="root"
        selectedFolder=""
      />,
    );

    const rows = screen.getAllByRole("button").map((row) => row.textContent);
    expect(rows).toEqual(["root", "zeta", "alpha"]);
  });

  it("renders Browse without a shortcut label", () => {
    render(
      <FileExplorerTree
        activePath="README.md"
        documents={documents}
        expandedPaths={new Set()}
        folders={folders}
        onOpenDocument={vi.fn()}
        onSelectFolder={vi.fn()}
        onToggleFolder={vi.fn()}
        rootName="single-folder"
        selectedFolder=""
      />,
    );

    expect(screen.getByRole("button", { name: "single-folder" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "README" })
        .getAttribute("aria-current"),
    ).toBe("page");
  });
});
