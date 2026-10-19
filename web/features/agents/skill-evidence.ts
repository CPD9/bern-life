// A skill's evidence as the screen shows it: one row per evaluator number it cites, filled in from
// /api/numbers. A row is never guessed: while the numbers are missing there is none, and the host's
// status line says why. Under DEMO_FIXTURES the numbers are invented, so each row is marked FIXTURE
// and its source says so instead of naming the evaluator.
import { formatInterval, formatTally } from "@/infrastructure/number-format";
import type { EvalNumbers } from "@/infrastructure/numbers";
import type { NumbersState } from "@/infrastructure/use-numbers";
import type { Measure, Skill } from "./skills";

/** One number: what it counts, the value as sent, and where it comes from. */
export type EvidenceRow = {
  readonly label: string;
  readonly value: string;
  readonly source: { readonly name: string; readonly href: string };
  readonly fixture: boolean;
};

/** The Garage's names for the same numbers, so both screens read alike. */
const measureLabels: Record<Measure, string> = {
  recall_at_10: "Recall@10",
  traceable: "Traceable claims",
  invented_abstained: "Invented questions abstained",
  false_abstention: "False abstentions",
};

const API = "/api/numbers";

function valueOf(numbers: EvalNumbers, measure: Measure): string {
  return measure === "recall_at_10"
    ? formatInterval(numbers.recall_at_10)
    : formatTally(numbers[measure]);
}

function sourceName(snapshot: string, numbers: EvalNumbers, fixtureMode: boolean): string {
  if (fixtureMode) return "Invented for the demo (DEMO_FIXTURES), not from the evaluator";
  const queries = numbers.queries === 1 ? "1 query" : `${numbers.queries} queries`;
  return `Bern Life’s evaluator on snapshot ${snapshot}, ${queries}`;
}

export function skillEvidence(
  skill: Skill,
  numbers: NumbersState,
  fixtureMode: boolean,
): readonly EvidenceRow[] {
  if (numbers.status !== "ok") return [];
  const evaluation = numbers.numbers.eval;
  if (evaluation === null) return [];
  const source = { name: sourceName(numbers.numbers.snapshot, evaluation, fixtureMode), href: API };
  return skill.measured.map((measure) => ({
    label: measureLabels[measure],
    value: valueOf(evaluation, measure),
    source,
    fixture: fixtureMode,
  }));
}
