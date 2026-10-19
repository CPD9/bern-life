// What the Navigator says while greeting a new player, in the name the player gave it (Lumi until
// they choose another). Each tap moves on to the next line and the last one leads back to the
// first, so a curious player can tap as often as they like. Every line describes something the
// app has: the Ask app on the phone, and the agent step at the end of onboarding.

export function greetingLines(name: string): readonly [string, string, string] {
  return [
    `Hi, I'm ${name}! I find the right people in Bern for you, each with the sentence that proves it.`,
    "First, a few questions about you. At the end you choose my name and my bear.",
    "Once you're in, open Ask on your phone and I'll search for you.",
  ];
}

export function nextLine(index: number, count: number): number {
  return (index + 1) % count;
}
