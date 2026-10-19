// What a reply's actions do on screen, through the host's callbacks. Each action goes with the
// search answer it is about, so the host can show it without looking anything up.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { AgentAction, AgentReply } from "./agent-reply";

export type LumiActions = {
  onShowOnMap?: ((response: SearchResponse) => void) | undefined;
  onOpenProfile?: ((profileId: string, response: SearchResponse) => void) | undefined;
  onStartMatchReport?: ((response: SearchResponse) => void) | undefined;
};

/** The words on the button for an action that waits for the player's click. */
export const heldActionLabels: Record<AgentAction["type"], string> = {
  show_on_map: "Show on the map",
  open_profile: "Open the card",
  start_match_report: "Make a match report",
};

/**
 * A match report opens outside the chat, in a new tab, so it waits for the player's own click even
 * when the reply lands with the panel open: an answer never opens a window by itself, and a browser
 * would block a window opened without a click anyway.
 */
export function waitsForClick(action: AgentAction): boolean {
  return action.type === "start_match_report";
}

function answerFor(action: AgentAction, reply: AgentReply): SearchResponse | undefined {
  if (action.type !== "open_profile") return reply.results[action.result];
  return reply.results.find((response) =>
    response.results.some((result) => result.profile.id === action.profile_id),
  );
}

function callbackFor(action: AgentAction, actions: LumiActions): unknown {
  switch (action.type) {
    case "show_on_map":
      return actions.onShowOnMap;
    case "open_profile":
      return actions.onOpenProfile;
    case "start_match_report":
      return actions.onStartMatchReport;
  }
}

/** Whether the action has an answer to act on and a host that listens for it. */
export function canRun(action: AgentAction, reply: AgentReply, actions: LumiActions): boolean {
  return answerFor(action, reply) !== undefined && callbackFor(action, actions) !== undefined;
}

export function runAction(action: AgentAction, reply: AgentReply, actions: LumiActions): void {
  const response = answerFor(action, reply);
  if (!response) return;
  switch (action.type) {
    case "show_on_map":
      actions.onShowOnMap?.(response);
      return;
    case "open_profile":
      actions.onOpenProfile?.(action.profile_id, response);
      return;
    case "start_match_report":
      actions.onStartMatchReport?.(response);
      return;
  }
}
