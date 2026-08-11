import type { TextMatch } from "./textSearch";

export type RenderedTextMatch = TextMatch & {
  readonly index: number;
};

type SourceSegment = {
  readonly rawFrom: number;
  readonly rawTo: number;
  readonly renderedFrom: number;
  readonly renderedTo: number;
};

const CHARACTER_REFERENCE = /^&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/i;

export function mapRawMatchesToRenderedText(
  body: string,
  renderedText: string,
  rawStart: number,
  rawEnd: number,
  matches: readonly TextMatch[],
): readonly RenderedTextMatch[] {
  const rawText = body.slice(rawStart, rawEnd);
  const segments: SourceSegment[] = [];
  let rawOffset = 0;
  let renderedOffset = 0;

  while (renderedOffset < renderedText.length) {
    const reference = rawText.slice(rawOffset).match(CHARACTER_REFERENCE)?.[0];
    if (reference) {
      const decoder = document.createElement("textarea");
      decoder.innerHTML = reference;
      const decoded = decoder.value;
      if (
        decoded !== reference &&
        renderedText.startsWith(decoded, renderedOffset)
      ) {
        segments.push({
          rawFrom: rawStart + rawOffset,
          rawTo: rawStart + rawOffset + reference.length,
          renderedFrom: renderedOffset,
          renderedTo: renderedOffset + decoded.length,
        });
        rawOffset += reference.length;
        renderedOffset += decoded.length;
        continue;
      }
    }

    const codePoint = renderedText.codePointAt(renderedOffset);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    const escaped =
      rawText[rawOffset] === "\\" &&
      rawText.slice(rawOffset + 1, rawOffset + 1 + character.length) ===
        character;
    const characterOffset = escaped
      ? rawOffset
      : rawText.indexOf(character, rawOffset);
    if (characterOffset < 0) {
      renderedOffset += character.length;
      continue;
    }
    const rawTo = characterOffset + character.length + (escaped ? 1 : 0);
    segments.push({
      rawFrom: rawStart + characterOffset,
      rawTo: rawStart + rawTo,
      renderedFrom: renderedOffset,
      renderedTo: renderedOffset + character.length,
    });
    rawOffset = rawTo;
    renderedOffset += character.length;
  }

  const renderedMatches: RenderedTextMatch[] = [];
  matches.forEach((match, index) => {
    if (match.from < rawStart || match.to > rawEnd) return;
    const overlapping = segments.filter(
      (segment) => segment.rawTo > match.from && segment.rawFrom < match.to,
    );
    const first = overlapping[0];
    const last = overlapping[overlapping.length - 1];
    if (!first || !last) return;
    renderedMatches.push({
      from: first.renderedFrom,
      to: last.renderedTo,
      index,
    });
  });
  return renderedMatches;
}
