export type TextMatch = {
  readonly from: number;
  readonly to: number;
};

type FoldedText = {
  readonly sourceFrom: readonly number[];
  readonly sourceTo: readonly number[];
  readonly value: string;
};

function foldWithSourceOffsets(text: string): FoldedText {
  const sourceFrom: number[] = [];
  const sourceTo: number[] = [];
  let offset = 0;

  for (const character of text) {
    const nextOffset = offset + character.length;
    const foldedLength = character.toLowerCase().length;
    for (let index = 0; index < foldedLength; index += 1) {
      sourceFrom.push(offset);
      sourceTo.push(nextOffset);
    }
    offset = nextOffset;
  }

  return { sourceFrom, sourceTo, value: text.toLowerCase() };
}

export function findLiteralMatches(
  text: string,
  query: string,
): readonly TextMatch[] {
  if (!query) return [];

  const source = foldWithSourceOffsets(text);
  const target = query.toLowerCase();
  const matches: TextMatch[] = [];
  let searchFrom = 0;

  while (searchFrom <= source.value.length - target.length) {
    const index = source.value.indexOf(target, searchFrom);
    if (index < 0) break;

    const from = source.sourceFrom[index];
    const to = source.sourceTo[index + target.length - 1];
    if (from === undefined || to === undefined) break;
    matches.push({ from, to });

    searchFrom = index + target.length;
    while (
      searchFrom < source.sourceFrom.length &&
      source.sourceFrom[searchFrom] < to
    ) {
      searchFrom += 1;
    }
  }

  return matches;
}
