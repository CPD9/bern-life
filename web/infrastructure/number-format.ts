// Numbers are written exactly as the engine sent them: no rounding, no percentages, no grouping,
// so what the Garage and the skills show can be checked digit for digit against the evaluator's
// output.
import type { Interval, Measure, Tally } from "./numbers";

export function formatInterval({ value, low, high }: Interval): string {
  return `${value} [${low}, ${high}]`;
}

export function formatTally({ n, of }: Tally): string {
  return `${n} / ${of}`;
}

export function formatMeasure(measure: Measure): string {
  return typeof measure === "number" ? String(measure) : formatInterval(measure);
}

export function formatMillis(ms: number | null): string {
  return ms === null ? "not recorded" : `${ms} ms`;
}
