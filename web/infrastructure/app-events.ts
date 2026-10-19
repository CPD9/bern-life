// What the player did, as named events. Story steps complete only on these, never by a tick box.
// The names come from contracts/quest.schema.json through the generated types, so a lane cannot
// emit an event the story does not know.
import type { Story } from "./contract-types.generated";

export type AppEventName = Story["quests"][number]["steps"][number]["done_when"];

export type AppEventSink = { emit(name: AppEventName): void };

export type AppEvents = AppEventSink & {
  subscribe(listener: (name: AppEventName) => void): () => void;
};

export function createAppEvents(): AppEvents {
  const listeners = new Set<(name: AppEventName) => void>();
  return {
    emit: (name) => {
      for (const listener of listeners) listener(name);
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const appEvents: AppEvents = createAppEvents();

/** Events some feature emits, but not in this mode, each with why its steps wait. */
export type OffEvents = Partial<Record<AppEventName, string>>;

/**
 * Events that never fire under DEMO_FIXTURES, where every person, call and number is invented:
 * nothing can be saved (app/shared-apps.tsx), and the garage's numbers are not the engine's
 * (features/garage/garage-app.tsx).
 */
export const offInFixtures: OffEvents = {
  opportunity_saved: "Saving is off for the invented demo data.",
  library_item_saved: "Saving is off for the invented demo data.",
  numbers_seen: "The Garage shows invented demo numbers here; only the engine's own numbers count.",
};

/**
 * Events some feature emits today. A quest that needs any other event shows as "coming next".
 * Add an event here in the same PR that emits it:
 * - search_answered, search_answered_other_language, brief_answered, abstained_seen:
 *   features/navigator/navigator-events.ts
 * - evidence_opened: infrastructure/ui/result-card.tsx
 * - report_made: features/report/open-report.ts
 * - lobby_entered: features/world/place-panel.tsx (opening a place on the map)
 * - message_sent: features/messages/use-messages.ts
 * - office_ready: features/shell/use-office-ready.ts (after onboarding: first office render, or
 *   sitting at the desk)
 * - opportunity_saved, library_item_saved: app/shared-apps.tsx (the Library's save button, through
 *   features/library/library-items.ts savedEventNames)
 * - garage_visited, numbers_seen: app/shared-apps.tsx (features/garage/garage-app.tsx). numbers_seen
 *   only once GET /api/numbers has answered with the evaluator's numbers, never for a fixture, and
 *   never while the route is not there yet (the garage then says the numbers are not connected)
 * - settled: app/world-settle.tsx (features/settle/settle.tsx, choosing a plot)
 * - connection_saved: app/world-connections.tsx (features/connections/use-connections.ts), when
 *   you accept a request, or a request you sent is found accepted; on the first read only while
 *   the notification that it was accepted is still unread (it was accepted while you were away)
 */
export const emittedToday: readonly AppEventName[] = [
  "search_answered",
  "search_answered_other_language",
  "evidence_opened",
  "brief_answered",
  "report_made",
  "abstained_seen",
  "lobby_entered",
  "message_sent",
  "office_ready",
  "opportunity_saved",
  "library_item_saved",
  "garage_visited",
  "numbers_seen",
  "settled",
  "connection_saved",
];
