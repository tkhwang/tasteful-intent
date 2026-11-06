// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MarkdownView } from "@/components/MarkdownView";

afterEach(cleanup);

const ALIGNED_TABLE = [
  "| Left | Center | Right |",
  "| :--- | :---: | ---: |",
  "| a | b | 3000 |",
].join("\n");

function renderBody(body: string) {
  return render(
    <MarkdownView body={body} documentPath="notes/table.md" root="/library" />,
  );
}

describe("MarkdownView tables", () => {
  it("renders GFM tables with header cells and column alignment", () => {
    const { container } = renderBody(ALIGNED_TABLE);

    expect(
      [...container.querySelectorAll("thead th")].map(
        (cell) => cell.textContent,
      ),
    ).toEqual(["Left", "Center", "Right"]);
    expect(
      [...container.querySelectorAll<HTMLElement>("tbody td")].map(
        (cell) => cell.style.textAlign,
      ),
    ).toEqual(["left", "center", "right"]);
  });

  it("wraps every table in its own horizontal scroll container", () => {
    const { container } = renderBody(
      `${ALIGNED_TABLE}\n\nBetween tables.\n\n${ALIGNED_TABLE}`,
    );
    const tables = [...container.querySelectorAll("table")];

    expect(tables).toHaveLength(2);
    for (const table of tables) {
      expect(table.parentElement?.className).toBe("markdown-table-scroll");
    }
  });

  it("renders bare <br> tags in table cells as line breaks", () => {
    const { container } = renderBody(
      [
        "| Step | Notes |",
        "| --- | --- |",
        "| 1 | first line<br>second line |",
        "| 2 | a<br/>b<BR />c |",
      ].join("\n"),
    );

    expect(
      [...container.querySelectorAll("tbody td:nth-child(2)")].map(
        (cell) => cell.innerHTML,
      ),
    ).toEqual(["first line<br>second line", "a<br>b<br>c"]);
  });

  it("keeps other raw HTML and code spans literal", () => {
    const { container } = renderBody(
      'Use `<br>` or <b>bold</b> and <br class="x">.',
    );
    const paragraph = container.querySelector("p");

    expect(paragraph?.querySelector("br, b")).toBeNull();
    expect(paragraph?.textContent).toBe(
      'Use <br> or <b>bold</b> and <br class="x">.',
    );
  });

  it("scrolls wide tables instead of breaking words inside cells", () => {
    const css = readFileSync(
      join(process.cwd(), "src/index.css"),
      "utf8",
    ).replace(/\s+/g, " ");

    expect(css).toMatch(
      /\.markdown-view \.markdown-table-scroll \{[^}]*overflow-x: auto;/,
    );
    expect(css).toMatch(
      /\.markdown-view th, \.markdown-view td \{[^}]*overflow-wrap: break-word;/,
    );
    expect(css).toMatch(
      /\.markdown-view th code, \.markdown-view td code \{[^}]*word-break: normal;/,
    );
  });
});
