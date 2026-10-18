// Marks topic words and added wordings inside a quoted sentence. Matching ignores case and
// accents, but the parts keep the page's own characters, so the quote stays verbatim.
import { foldText } from "@/infrastructure/text-match";

export type HighlightPart = { readonly text: string; readonly marked: boolean };

function foldWithOffsets(text: string): { folded: string; origin: number[] } {
  let folded = "";
  const origin: number[] = [];
  let offset = 0;
  for (const char of text) {
    for (const foldedChar of foldText(char)) {
      folded += foldedChar;
      origin.push(offset);
    }
    offset += char.length;
  }
  return { folded, origin };
}

function markedRanges(text: string, terms: readonly string[]): [number, number][] {
  const { folded, origin } = foldWithOffsets(text);
  const ranges: [number, number][] = [];
  for (const term of terms) {
    const needle = foldText(term.trim());
    if (needle.length < 2) continue;
    for (let at = folded.indexOf(needle); at !== -1; at = folded.indexOf(needle, at + 1)) {
      const start = origin[at] ?? 0;
      const lastOrigin = origin[at + needle.length - 1] ?? start;
      const lastChar = text.codePointAt(lastOrigin) ?? 0;
      ranges.push([start, lastOrigin + (lastChar > 0xffff ? 2 : 1)]);
    }
  }
  return ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
}

export function highlightParts(text: string, terms: readonly string[]): HighlightPart[] {
  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const [start, end] of markedRanges(text, terms)) {
    if (end <= cursor) continue;
    const from = Math.max(start, cursor);
    if (from > cursor) parts.push({ text: text.slice(cursor, from), marked: false });
    parts.push({ text: text.slice(from, end), marked: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), marked: false });
  return parts;
}
