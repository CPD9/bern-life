import type { Criterion } from "./engine";

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
