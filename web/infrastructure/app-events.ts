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

/**
 * Events some feature emits today. A quest that needs any other event shows as "coming next".
 * Add an event here in the same PR that emits it:
 * - search_answered, search_answered_other_language, brief_answered, abstained_seen:
 *   features/navigator/navigator-events.ts
 * - evidence_opened: infrastructure/ui/result-card.tsx
 * - report_made: features/report/open-report.ts
 */
export const emittedToday: readonly AppEventName[] = [
  "search_answered",
  "search_answered_other_language",
  "evidence_opened",
  "brief_answered",
  "report_made",
  "abstained_seen",
];
