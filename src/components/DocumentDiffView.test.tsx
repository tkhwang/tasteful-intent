// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentDiffView } from "./DocumentDiffView";

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", () => 0);
  vi.stubGlobal("cancelAnimationFrame", () => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const UNCHANGED_LINES = Array.from(
  { length: 14 },
  (_, index) => `unchanged ${index + 1}`,
);
const longBaseline = ["first old", ...UNCHANGED_LINES, "last old"].join("\n");
const longBody = ["first new", ...UNCHANGED_LINES, "last new"].join("\n");

// Six unchanged lines is the realistic memo shape that the upstream default
// (`{margin: 3, minSize: 4}`) refused to fold, which made `changes` and `full`
// render identically. See CHANGES_COLLAPSE in DocumentDiffView.tsx.
const SHORT_UNCHANGED_LINES = Array.from(
  { length: 6 },
  (_, index) => `unchanged ${index + 1}`,
);
const shortBaseline = ["first old", ...SHORT_UNCHANGED_LINES, "last old"].join(
  "\n",
);
const shortBody = ["first new", ...SHORT_UNCHANGED_LINES, "last new"].join(
  "\n",
);

describe("DocumentDiffView", () => {
  it("변경된 내용에 삭제/추가 chunk를 렌더한다", () => {
    const { container } = render(
      <DocumentDiffView
        baseline={"alpha\nbeta\n"}
        body={"alpha\ngamma\n"}
        cleanLabel="변경 없음"
        variant="changes"
      />,
    );
    expect(container.querySelector(".cm-deletedChunk")).not.toBeNull();
    expect(container.querySelector(".cm-changedLine")).not.toBeNull();
  });

  it("baseline과 동일하면 변경 없음 안내를 보여준다", () => {
    const { container } = render(
      <DocumentDiffView
        baseline={"same\n"}
        body={"same\n"}
        cleanLabel="변경 없음"
        variant="changes"
      />,
    );
    expect(screen.getByText("변경 없음")).toBeTruthy();
    expect(container.querySelector(".cm-editor")).toBeNull();
  });

  it("variant가 changes면 충분히 긴 미변경 구간을 접는다", () => {
    const { container } = render(
      <DocumentDiffView
        baseline={longBaseline}
        body={longBody}
        cleanLabel="변경 없음"
        variant="changes"
      />,
    );
    expect(container.querySelector(".cm-collapsedLines")).not.toBeNull();
  });

  it("variant가 changes면 짧은 미변경 구간도 접어서 full과 구별된다", () => {
    const { container: changes } = render(
      <DocumentDiffView
        baseline={shortBaseline}
        body={shortBody}
        cleanLabel="변경 없음"
        variant="changes"
      />,
    );
    expect(changes.querySelector(".cm-collapsedLines")).not.toBeNull();

    const { container: full } = render(
      <DocumentDiffView
        baseline={shortBaseline}
        body={shortBody}
        cleanLabel="변경 없음"
        variant="full"
      />,
    );
    expect(full.querySelector(".cm-collapsedLines")).toBeNull();
    expect(full.textContent).toContain("unchanged 4");
  });

  it("variant가 full이면 미변경 구간도 모두 펼쳐서 보여준다", () => {
    const { container } = render(
      <DocumentDiffView
        baseline={longBaseline}
        body={longBody}
        cleanLabel="변경 없음"
        variant="full"
      />,
    );
    expect(container.querySelector(".cm-collapsedLines")).toBeNull();
    expect(container.textContent).toContain("unchanged 7");
  });
});
