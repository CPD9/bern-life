// What a reply's actions do on screen, through the host's callbacks. Each action goes with the
// search answer it is about, so the host can show it without looking anything up.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { AgentAction, AgentReply } from "./agent-reply";

export type LumiActions = {
  onShowOnMap?: ((response: SearchResponse) => void) | undefined;
  onOpenProfile?: ((profileId: string, response: SearchResponse) => void) | undefined;
  /** Makes and keeps the report; false when it could not be kept, as when storage is blocked. */
  onStartMatchReport?: ((response: SearchResponse) => boolean) | undefined;
};

/** The words on the button for an action that waits for the player's click. */
export const heldActionLabels: Record<AgentAction["type"], string> = {
  show_on_map: "Show on the map",
  open_profile: "Open the card",
  start_match_report: "Make a match report",
};

/** Said under the button when the report could not be kept; the button stays, to try again. */
export const reportNotKept =
  "This browser blocks storage, so the report could not be kept. Allow site storage and try again.";

/**
 * A match report keeps a new record and takes the player out of the chat, to wherever the host
 * shows it, so it waits for the player's own click even when the reply lands with the panel open:
 * an answer never makes one by itself.
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

/** False when the action was not done: no answer to act on, or a report that was not kept. */
export function runAction(action: AgentAction, reply: AgentReply, actions: LumiActions): boolean {
  const response = answerFor(action, reply);
  if (!response) return false;
  switch (action.type) {
    case "show_on_map":
      actions.onShowOnMap?.(response);
      return true;
    case "open_profile":
      actions.onOpenProfile?.(action.profile_id, response);
      return true;
    case "start_match_report":
      return actions.onStartMatchReport?.(response) ?? false;
  }
}
