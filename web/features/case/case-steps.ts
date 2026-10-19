// The case's six success criteria and its ethics rule, as seven steps a jury member walks in
// order. Each step is one phone app: the case's words, one thing to try, and what to look for.
// The questions are the recorded ones (infra/demo/queries.jsonl), so they replay from the bundle.
import type { Story } from "@/infrastructure/contract-types.generated";

export type Criterion = Story["quests"][number]["criterion"];

/** Runs a question in Ask; the rest are offered afterwards, to compare wordings. */
export type AskAction = { readonly kind: "ask"; readonly query: string; readonly then: string[] };
/** Opens another app on the phone. */
export type OpenAction = { readonly kind: "open"; readonly appId: string };
export type StepAction = AskAction | OpenAction;

export type CaseStep = {
  readonly number: number;
  /** The tile's name and the app's title: the number, then one or two words. */
  readonly label: string;
  readonly criterion: Criterion;
  /** What the case asks, in one plain sentence. */
  readonly asks: string;
  readonly action: StepAction;
  readonly lookFor: readonly string[];
};

export const alarmQuestion =
  "Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?";

export const inventedQuestion =
  "Results of the ALPENHITZE cohort study led by Prof. Beat Zurbriggen at ISPM";

const ask = (query: string, ...then: string[]): AskAction => ({ kind: "ask", query, then });

export const caseSteps: readonly CaseStep[] = [
  {
    number: 1,
    label: "1 People",
    criterion: "c1-right-people",
    asks: "Finds the right people: at least 80% of the expected experts or units are in the top 10 results.",
    action: ask(alarmQuestion),
    lookFor: [
      "People and units in Bern who work on this, each with a role and a short reason for the match.",
    ],
  },
  {
    number: 2,
    label: "2 Wording",
    criterion: "c2-wording",
    asks: "Handles different wording: lay words and synonyms find the same experts as the site's own terms.",
    action: ask("glucose sensors", "CGM", "Blutzucker messen"),
    lookFor: [
      "The same people come up for each wording.",
      "“Also searched for” lists the terms the search added, as search terms, never as facts.",
    ],
  },
  {
    number: 3,
    label: "3 Proof",
    criterion: "c3-traceable",
    asks: "Every result is traceable: each one links to a public page that supports it, and nothing is invented.",
    action: ask(alarmQuestion),
    lookFor: [
      "Tap a role or unit on the first card: the sentence from the page, the page and its date appear.",
    ],
  },
  {
    number: 4,
    label: "4 Fields",
    criterion: "c4-structured",
    asks: "Structured results: each result fills person, role, unit, expertise, projects, infrastructure or services, reason for match and source link, where the page gives them.",
    action: ask(alarmQuestion),
    lookFor: [
      "The fields on the first card. An empty field means the page does not say it; nothing is guessed.",
    ],
  },
  {
    number: 5,
    label: "5 Sources",
    criterion: "c5-sources",
    asks: "Covers all three sources: the University of Bern, ARTORG and Diabetes Center Berne.",
    action: ask(alarmQuestion),
    lookFor: ["Results from more than one institution; the source link on each card says which."],
  },
  {
    number: 6,
    label: "6 Add a site",
    criterion: "c6-extend",
    asks: "Easy to extend: a new institutional website is added by configuration or a short documented step, without rewriting the pipeline.",
    action: { kind: "open", appId: "sources" },
    lookFor: [
      "The institutions crawled, and how a new one is added: one JSON file in sources/ and one command.",
    ],
  },
  {
    number: 7,
    label: "7 Honest no",
    criterion: "ethics-abstain",
    asks: "Says clearly when no reliable, verifiable source exists.",
    action: ask(inventedQuestion),
    lookFor: [
      "Neither the study nor the professor exists. The answer says no verifiable source supports it, instead of inventing one.",
    ],
  },
];

export function caseStepAppId(step: CaseStep): string {
  return `case-${step.number}`;
}

export function stepAfter(step: CaseStep): CaseStep | null {
  return caseSteps.find((candidate) => candidate.number === step.number + 1) ?? null;
}

export function stepBefore(step: CaseStep): CaseStep | null {
  return caseSteps.find((candidate) => candidate.number === step.number - 1) ?? null;
}
