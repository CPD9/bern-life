import type { QuestStep } from "./engine";

export type ShowMeTarget = "ask" | "map" | "settle" | "opportunities";

const targets: Partial<Record<QuestStep["done_when"], ShowMeTarget>> = {
  search_answered: "ask",
  search_answered_other_language: "ask",
  evidence_opened: "ask",
  brief_answered: "ask",
  report_made: "ask",
  abstained_seen: "ask",
  settled: "settle",
  opportunity_saved: "opportunities",
  library_item_saved: "opportunities",
  lobby_entered: "map",
};

/** Where "Show me" takes the player for a step, if the step has a place in the app. */
export function showMeTarget(step: QuestStep): ShowMeTarget | null {
  return targets[step.done_when] ?? null;
}
