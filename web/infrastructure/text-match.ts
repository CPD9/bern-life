// Loose word matching shared by the fixture client and the brief's aspect matrix: case and
// accents are ignored and filler words in de/en/fr do not count as a match.

const fillerWords = new Set([
  "and",
  "the",
  "for",
  "with",
  "und",
  "der",
  "die",
  "das",
  "des",
  "mit",
  "fur",
  "von",
  "les",
  "pour",
  "avec",
  "une",
  "aux",
]);

export function foldText(text: string): string {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
}

export function contentWords(text: string): string[] {
  const words = foldText(text).split(/[^\p{L}\p{N}]+/u);
  return [...new Set(words.filter((word) => word.length >= 3 && !fillerWords.has(word)))];
}
