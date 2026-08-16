export function suggestDocsFolderLabel(root: string): string {
  const basename = root.split("/").filter(Boolean).at(-1) ?? "AI";
  return graphemes(basename).slice(0, 2).join("");
}

export function validateDocsFolderLabel(value: string): string | null {
  const label = value.trim();
  const length = graphemes(label).length;
  return length >= 1 && length <= 2 ? label : null;
}

function graphemes(value: string): string[] {
  return [
    ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
      value,
    ),
  ].map(({ segment }) => segment);
}
