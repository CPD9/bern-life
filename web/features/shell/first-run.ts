// Which card a newcomer sees beside the map, following the first-run order: the map first, then
// a gentle invitation to join after a real action, then onboarding, settling, then the story. Pure, so the
// order is tested; nothing here blocks the map.

export type FirstRunCard =
  "greeting" | "join" | "onboarding" | "settle" | "story-start" | "quest" | null;

export type FirstRunInput = {
  readonly account: "checking" | "signed-out" | "signed-in";
  readonly onboarded: boolean;
  readonly storyChoice: "story" | "free" | null;
  /** Any story step done means the player already did something real (a search, evidence…). */
  readonly actedAlready: boolean;
  readonly greetingDismissed: boolean;
  readonly joinDismissed: boolean;
  /** An office plot is chosen on this device. */
  readonly settled: boolean;
  readonly settleDismissed: boolean;
};

export function firstRunCard(input: FirstRunInput): FirstRunCard {
  // In the story, the quest panel leads to settling; outside it, the card does once.
  if (input.storyChoice === "story") return "quest";
  if (input.onboarded && !input.settled && !input.settleDismissed) return "settle";
  if (input.storyChoice === "free") return null;
  if (input.onboarded) return "story-start";
  if (input.account === "signed-in") return "onboarding";
  if (input.account === "signed-out" && input.actedAlready && !input.joinDismissed) return "join";
  return input.greetingDismissed ? null : "greeting";
}

/** Home is your office: someone who finished onboarding lands there; a newcomer starts on the map. */
export function landingView(onboarded: boolean): "home" | "map" {
  return onboarded ? "home" : "map";
}
