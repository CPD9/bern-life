// A result's quality metrics as the engine computed them (`metrics` in result.schema.json,
// docs/metrics.md), worded once for the result card and the match report. They describe a result
// and never reorder it; a value that could not be computed shows as a dash, never as 0.
import type { SearchResult } from "@/infrastructure/claims";

export const notComputed = "—";

export const metricMeanings = {
  Relevance: "Share of your topics found in this result's verified claims",
  Evidence: "How directly the public pages tie this result to the topics",
  Completeness: "Profile fields the public pages fill, out of five",
  Confidence: "How often results like this were right on hand-checked questions",
} as const;

export type MetricLabel = keyof typeof metricMeanings;

/**
 * One bar: the value as text, exactly as the engine sent it, and the raw number with its scale
 * for the track. `now` is null when the engine could not compute it: the track stays empty.
 */
export type MetricBar = {
  readonly label: MetricLabel;
  readonly value: string;
  readonly now: number | null;
  readonly max: number;
};

type Metrics = NonNullable<SearchResult["metrics"]>;

export function percent(value: number | null): string {
  return value === null ? notComputed : `${Math.round(value * 100)}%`;
}

export function confidenceText(value: number | null): string {
  return value === null ? "not yet calibrated" : percent(value);
}

function share(label: MetricLabel, value: number | null): MetricBar {
  return { label, value: percent(value), now: value, max: 1 };
}

/**
 * The bars of the card, in the report's order. Confidence joins as a fourth bar once the engine
 * has calibrated it; while it is null the card says nothing and the report says so in words.
 */
export function metricBars(metrics: Metrics | null | undefined): MetricBar[] {
  if (!metrics) return [];
  const { filled, of } = metrics.completeness;
  const bars = [
    share("Relevance", metrics.relevance),
    share("Evidence", metrics.evidence),
    { label: "Completeness" as const, value: `${filled} of ${of}`, now: filled, max: of },
  ];
  if (metrics.confidence !== null) bars.push(share("Confidence", metrics.confidence));
  return bars;
}

function addsText(metrics: Metrics): string | null {
  return metrics.novelty.adds.length > 0 ? `Adds: ${metrics.novelty.adds.join(", ")}` : null;
}

/** Whether the result brings a unit not seen above it, and which topics it adds. */
export function noveltyTags(metrics: Metrics | null | undefined): string[] {
  if (!metrics) return [];
  const tags = [metrics.novelty.new_unit ? "New unit" : "Unit already above"];
  const adds = addsText(metrics);
  if (adds) tags.push(adds);
  return tags;
}

/** The same as one chip for the card; nothing when the result adds nothing new. */
export function noveltyChip(metrics: Metrics): string | null {
  const parts = [metrics.novelty.new_unit ? "New unit" : null, addsText(metrics)].filter(
    (part) => part !== null,
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
