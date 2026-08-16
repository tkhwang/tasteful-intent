import { describe, expect, it } from "vitest";
import {
  suggestDocsFolderLabel,
  validateDocsFolderLabel,
} from "./docsFolderLabel";

describe("docs folder labels", () => {
  it("suggests the first two graphemes from a folder basename", () => {
    expect(suggestDocsFolderLabel("/work/기획서")).toBe("기획");
    expect(suggestDocsFolderLabel("/work/👨‍👩‍👧‍👦-task")).toBe("👨‍👩‍👧‍👦-");
  });

  it("accepts duplicate-friendly labels with one or two graphemes", () => {
    expect(validateDocsFolderLabel(" T1 ")).toBe("T1");
    expect(validateDocsFolderLabel("가")).toBe("가");
    expect(validateDocsFolderLabel("ABC")).toBeNull();
    expect(validateDocsFolderLabel("  ")).toBeNull();
  });
});
