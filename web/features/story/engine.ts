// The quest engine: story + what the player did → where they are. Pure, so every rule is tested.
// Rules: a step completes only on its event. In a required quest it also waits for the steps before
// it; an optional quest's steps count in any order, since its parts live in separate apps. Done
// steps never go away, so a finished quest stays finished and repeating an event changes nothing.
// A quest that cannot be finished with the events features emit today is "coming": listed with its
// reason, never current, so nobody waits on a step no one can complete. An optional quest with some
// steps playable is open for those, and says why the rest wait (`reasons`). Events that are off in
// this mode (`OffEvents`, such as saving under the demo fixtures) count as not emitted.
import type { AppEventName, OffEvents } from "@/infrastructure/app-events";
import type { Story } from "@/infrastructure/contract-types.generated";

export type Quest = Story["quests"][number];
export type QuestStep = Quest["steps"][number];
export type Criterion = Quest["criterion"];

export type StoryState = {
  readonly choice: "story" | "free" | null;
  readonly done: readonly string[];
  readonly focus: string | null;
};

export const emptyStoryState: StoryState = { choice: null, done: [], focus: null };

export type QuestStatus = "done" | "current" | "ready" | "coming";

export type QuestProgress = {
  readonly quest: Quest;
  readonly status: QuestStatus;
  readonly stepsDone: number;
  readonly nextStep: QuestStep | null;
  /** Every step left can be done with today's events; false while one waits on a later feature. */
  readonly finishable: boolean;
  /** Why the steps left that cannot be done wait, each reason once; empty when finishable. */
  readonly reasons: readonly string[];
};

export type StoryProgress = {
  readonly quests: QuestProgress[];
  readonly current: QuestProgress | null;
  readonly finishedCriteria: Criterion[];
};

export function stepKey(quest: Quest, step: QuestStep): string {
  return `${quest.id}/${step.id}`;
}

/** Said on a "coming next" row when the story gives no reason of its own. */
export const defaultComingReason = "Its steps do not report to the story yet.";

export function comingReason(quest: Quest): string {
  return quest.coming ?? defaultComingReason;
}

function remainingSteps(quest: Quest, done: ReadonlySet<string>): QuestStep[] {
  return quest.steps.filter((step) => !done.has(stepKey(quest, step)));
}

/** The step an event completes: the next one in order, or any open one in an optional quest. */
function stepFor(quest: Quest, done: ReadonlySet<string>, event: AppEventName): QuestStep | null {
  const remaining = remainingSteps(quest, done);
  const candidates = quest.optional ? remaining : remaining.slice(0, 1);
  return candidates.find((step) => step.done_when === event) ?? null;
}

export function applyEvent(story: Story, state: StoryState, event: AppEventName): StoryState {
  const done = new Set(state.done);
  const completed = story.quests.flatMap((quest) => {
    const step = stepFor(quest, done, event);
    return step ? [stepKey(quest, step)] : [];
  });
  if (completed.length === 0) return state;
  return { ...state, done: [...state.done, ...completed] };
}

export function storyProgress(
  story: Story,
  state: StoryState,
  emitted: readonly AppEventName[],
  off: OffEvents = {},
): StoryProgress {
  const done = new Set(state.done);
  const playable = new Set(emitted.filter((event) => off[event] === undefined));
  const base = story.quests.map((quest) => {
    const remaining = remainingSteps(quest, done);
    const reachable = remaining.filter((step) => playable.has(step.done_when));
    const waiting = remaining.filter((step) => !playable.has(step.done_when));
    // In order, every remaining step must be playable; in any order, one is enough to go on with.
    const coming = quest.optional ? reachable.length === 0 : reachable.length < remaining.length;
    const next = (quest.optional ? reachable[0] : undefined) ?? remaining[0] ?? null;
    return {
      quest,
      stepsDone: quest.steps.length - remaining.length,
      nextStep: next,
      finishable: waiting.length === 0,
      reasons: [...new Set(waiting.map((step) => off[step.done_when] ?? comingReason(quest)))],
      status: (next === null ? "done" : coming ? "coming" : "ready") as QuestStatus,
    };
  });
  const open = base.filter((entry) => entry.status === "ready");
  const current =
    open.find((entry) => entry.quest.id === state.focus) ??
    open.find((entry) => !entry.quest.optional) ??
    open[0] ??
    null;
  const quests = base.map((entry) =>
    entry === current ? { ...entry, status: "current" as const } : entry,
  );
  return {
    quests,
    current: current && { ...current, status: "current" },
    finishedCriteria: [
      ...new Set(
        quests.filter((entry) => entry.status === "done").map((entry) => entry.quest.criterion),
      ),
    ],
  };
}
