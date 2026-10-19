// A skill's evidence as the screen shows it: its measured rows filled in from /api/numbers, then
// its quoted rows. A measured row is never guessed: while the numbers are missing it is left out
// and a note says why. Under DEMO_FIXTURES the numbers are invented, so each row is marked FIXTURE
// and its source says so instead of naming the evaluator.
import { formatInterval, formatTally } from "@/infrastructure/number-format";
import type { EvalNumbers } from "@/infrastructure/numbers";
import type { NumbersState } from "@/infrastructure/use-numbers";
import type { Evidence, EvidenceSource, Measure, Skill } from "./skills";

export type EvidenceRow = Evidence & { readonly fixture: boolean };

export type SkillEvidence = { readonly rows: readonly EvidenceRow[]; readonly note: string | null };

/** The Garage's names for the same numbers, so both screens read alike. */
const measureLabels: Record<Measure, string> = {
  recall_at_10: "Recall@10",
  traceable: "Traceable claims",
  invented_abstained: "Invented questions abstained",
  false_abstention: "False abstentions",
};

const API = "/api/numbers";

export const NO_EVIDENCE = "No numbers back this skill yet.";

const MISSING: Record<Exclude<NumbersState["status"], "ok">, string> = {
  loading: "Loading Bern Life’s numbers.",
  not_connected: "Bern Life’s numbers are not connected yet.",
  error: "Bern Life’s numbers could not be loaded.",
};

function valueOf(numbers: EvalNumbers, measure: Measure): string {
  return measure === "recall_at_10"
    ? formatInterval(numbers.recall_at_10)
    : formatTally(numbers[measure]);
}

function sourceOf(snapshot: string, numbers: EvalNumbers, fixtureMode: boolean): EvidenceSource {
  if (fixtureMode) {
    return { name: "Invented for the demo (DEMO_FIXTURES), not from the evaluator", href: API };
  }
  const queries = numbers.queries === 1 ? "1 query" : `${numbers.queries} queries`;
  return { name: `Bern Life’s evaluator on snapshot ${snapshot}, ${queries}`, href: API };
}

export function skillEvidence(
  skill: Skill,
  numbers: NumbersState,
  fixtureMode: boolean,
): SkillEvidence {
  const quoted = skill.quoted.map((row) => ({ ...row, fixture: false }));
  if (skill.measured.length === 0) {
    return { rows: quoted, note: quoted.length === 0 ? NO_EVIDENCE : null };
  }
  if (numbers.status !== "ok") return { rows: quoted, note: MISSING[numbers.status] };
  const evaluation = numbers.numbers.eval;
  if (evaluation === null) {
    return { rows: quoted, note: "The evaluator has not run on this snapshot." };
  }
  const source = sourceOf(numbers.numbers.snapshot, evaluation, fixtureMode);
  const measured = skill.measured.map((measure) => ({
    label: measureLabels[measure],
    value: valueOf(evaluation, measure),
    source,
    fixture: fixtureMode,
  }));
  return { rows: [...measured, ...quoted], note: null };
}
