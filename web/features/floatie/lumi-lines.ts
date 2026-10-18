// What Lumi says while greeting a new player. Each tap moves on to the next line and the last one
// leads back to the first, so a curious player can tap as often as they like.

export const FLOATIE_NAME = "Lumi";

export const greetingLines = [
  "Hi, I'm Lumi! I'll help you find the right people in Bern, each with the sentence that proves it.",
  "First, tell me a little about you. You can change any answer later.",
  "Once you're in, tap me anywhere in Bern to ask a question.",
] as const;

export function nextLine(index: number): number {
  return (index + 1) % greetingLines.length;
}
