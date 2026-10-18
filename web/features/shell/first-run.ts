// Which card a newcomer sees beside the map, following the first-run order: the map first, then
// a gentle invitation to join after a real action, then onboarding, then the story. Pure, so the
// order is tested; nothing here blocks the map.

export type FirstRunCard = "greeting" | "join" | "onboarding" | "story-start" | "quest" | null;

export type FirstRunInput = {
  readonly account: "checking" | "signed-out" | "signed-in";
  readonly onboarded: boolean;
  readonly storyChoice: "story" | "free" | null;
  /** Any story step done means the player already did something real (a search, evidence…). */
  readonly actedAlready: boolean;
  readonly greetingDismissed: boolean;
  readonly joinDismissed: boolean;
};

export function firstRunCard(input: FirstRunInput): FirstRunCard {
  if (input.storyChoice === "story") return "quest";
  if (input.storyChoice === "free") return null;
  if (input.onboarded) return "story-start";
  if (input.account === "signed-in") return "onboarding";
  if (input.account === "signed-out" && input.actedAlready && !input.joinDismissed) return "join";
  return input.greetingDismissed ? null : "greeting";
}
