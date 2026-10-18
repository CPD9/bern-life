// The quest engine: story + what the player did → where they are. Pure, so every rule is tested.
// Rules: a step completes only on its event and only after the steps before it in its quest; done
// steps never go away, so a finished quest stays finished and repeating an event changes nothing.
// A quest whose events no feature emits yet is "coming": listed, never current, so nobody waits on
// a step no one can complete.
import type { AppEventName } from "@/infrastructure/app-events";
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
};

export type StoryProgress = {
  readonly quests: QuestProgress[];
  readonly current: QuestProgress | null;
  readonly finishedCriteria: Criterion[];
};

export function stepKey(quest: Quest, step: QuestStep): string {
  return `${quest.id}/${step.id}`;
}

function nextStep(quest: Quest, done: ReadonlySet<string>): QuestStep | null {
  return quest.steps.find((step) => !done.has(stepKey(quest, step))) ?? null;
}

export function applyEvent(story: Story, state: StoryState, event: AppEventName): StoryState {
  const done = new Set(state.done);
  const completed = story.quests.flatMap((quest) => {
    const step = nextStep(quest, done);
    return step?.done_when === event ? [stepKey(quest, step)] : [];
  });
  if (completed.length === 0) return state;
  return { ...state, done: [...state.done, ...completed] };
}

export function storyProgress(
  story: Story,
  state: StoryState,
  emitted: readonly AppEventName[],
): StoryProgress {
  const done = new Set(state.done);
  const playable = new Set(emitted);
  const base = story.quests.map((quest) => {
    const next = nextStep(quest, done);
    const coming = next !== null && quest.steps.some((step) => !playable.has(step.done_when));
    return {
      quest,
      stepsDone: next ? quest.steps.indexOf(next) : quest.steps.length,
      nextStep: next,
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
