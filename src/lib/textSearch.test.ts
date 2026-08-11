import { describe, expect, it } from "vitest";
import { findLiteralMatches } from "@/lib/textSearch";

describe("findLiteralMatches", () => {
  it("returns UTF-16 offsets into the original text after lowercase expansion", () => {
    const body = "🙂İX X";
    const matches = findLiteralMatches(body, "x");

    expect(matches).toEqual([
      { from: 3, to: 4 },
      { from: 5, to: 6 },
    ]);
    expect(matches.map(({ from, to }) => body.slice(from, to))).toEqual([
      "X",
      "X",
    ]);
    expect(findLiteralMatches(body, "i")).toEqual([{ from: 2, to: 3 }]);
  });
});
