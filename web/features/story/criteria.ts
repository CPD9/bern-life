import { type Criterion, type StoryProgress, comingReason } from "./engine";

/** The case's success criteria (docs/case.md), short enough for a tag on the quest card. */
export const criterionTags: Record<Criterion, string> = {
  "c1-right-people": "Case: the right people",
  "c2-wording": "Case: different wording",
  "c3-traceable": "Case: traceable",
  "c4-structured": "Case: structured results",
  "c5-sources": "Case: all three sources",
  "c6-extend": "Case: easy to extend",
  "ethics-abstain": "Ethics: says when unsure",
  stretch: "Beyond the case",
};

/** The jury's checklist: the six success criteria and the abstention rule, in case order. */
export const checklistCriteria: { criterion: Criterion; label: string }[] = [
  { criterion: "c1-right-people", label: "Finds the right people" },
  { criterion: "c2-wording", label: "Handles different wording" },
  { criterion: "c3-traceable", label: "Every result is traceable" },
  { criterion: "c4-structured", label: "Structured results" },
  { criterion: "c5-sources", label: "Covers all three sources" },
  { criterion: "c6-extend", label: "Easy to extend" },
  { criterion: "ethics-abstain", label: "Says when no page supports it" },
];

export const noQuestYet = "No quest shows this yet.";

export type CriterionRow = {
  readonly criterion: Criterion;
  readonly label: string;
  readonly met: boolean;
  /** Why an unmet criterion cannot be shown in the game yet; null when a quest can show it. */
  readonly note: string | null;
};

// A criterion is met only by a finished quest. An unmet one says why it waits: the reason of its
// quest that is coming next, or that no quest covers it, so the checklist never implies more.
export function criterionRows(progress: StoryProgress): CriterionRow[] {
  const finished = new Set(progress.finishedCriteria);
  return checklistCriteria.map(({ criterion, label }) => {
    const quests = progress.quests.filter((entry) => entry.quest.criterion === criterion);
    const met = finished.has(criterion);
    const playable = quests.some((entry) => entry.status !== "coming");
    const coming = quests.find((entry) => entry.status === "coming");
    const note = met || playable ? null : coming ? comingReason(coming.quest) : noQuestYet;
    return { criterion, label, met, note };
  });
}
