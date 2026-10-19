// What the evaluator measured for one step, read from /api/numbers and written digit for digit.
// The case sets a bar for two criteria (80% found, 100% traceable): met or not is decided here
// from the engine's own numbers and said in plain words. A criterion the evaluator does not
// measure has no reading, and the screen says so instead of showing something near it.
import { formatInterval, formatMeasure, formatTally } from "@/infrastructure/number-format";
import type { EvalNumbers } from "@/infrastructure/numbers";
import type { Criterion } from "./case-steps";

export type NumberRow = { readonly label: string; readonly value: string };
export type Verdict = { readonly bar: string; readonly met: boolean };
export type StepReading = {
  readonly rows: readonly NumberRow[];
  readonly verdict: Verdict | null;
};

const RECALL_BAR = 0.8;

/** The evaluator's slice names (eval/src/evaluator/summary.py), in the words of the case. */
const wordings: Record<string, string> = {
  site: "the site's own words",
  synonym: "synonyms",
  lay: "lay words",
  translation: "translations",
};

const institutions: Record<string, string> = {
  unibe: "University of Bern",
  artorg: "ARTORG",
  dcb: "Diabetes Center Berne",
};

function sliceRows(
  numbers: EvalNumbers,
  prefix: string,
  names: Record<string, string>,
): NumberRow[] {
  return numbers.slices.flatMap((slice) => {
    if (!slice.name.startsWith(prefix)) return [];
    const name = names[slice.name.slice(prefix.length)];
    return name === undefined
      ? []
      : [{ label: `Recall@10, ${name}`, value: formatMeasure(slice.recall_at_10) }];
  });
}

export function stepReading(criterion: Criterion, numbers: EvalNumbers): StepReading | null {
  switch (criterion) {
    case "c1-right-people":
      return {
        rows: [{ label: "Recall@10", value: formatInterval(numbers.recall_at_10) }],
        verdict: {
          bar: `at least ${RECALL_BAR}`,
          met: numbers.recall_at_10.value >= RECALL_BAR,
        },
      };
    case "c2-wording":
      return { rows: sliceRows(numbers, "variant:", wordings), verdict: null };
    case "c3-traceable":
      return {
        rows: [
          { label: "Traceable claims", value: formatTally(numbers.traceable) },
          { label: "Invented entities", value: String(numbers.invented_entities) },
        ],
        verdict: {
          bar: "every claim traceable and 0 invented",
          met: numbers.traceable.n === numbers.traceable.of && numbers.invented_entities === 0,
        },
      };
    case "c5-sources":
      return { rows: sliceRows(numbers, "source:", institutions), verdict: null };
    case "ethics-abstain":
      return {
        rows: [
          {
            label: "Invented questions abstained",
            value: formatTally(numbers.invented_abstained),
          },
          { label: "False abstentions", value: formatTally(numbers.false_abstention) },
        ],
        verdict: null,
      };
    case "c4-structured":
    case "c6-extend":
    case "stretch":
      return null;
  }
}
