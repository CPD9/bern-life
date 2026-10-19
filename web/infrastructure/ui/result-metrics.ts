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
 * Whether the engine's topic count describes this result. The engine counts a topic as covered
 * when the result's own verified claims mention it. A result that came in through a related
 * project or unit (`via`) or through a passage on its own page matched there, not in its own
 * claims, so for it the count reports every topic as missing and relevance as 0% right beside
 * the sentence that matches. That is a gap in the count, not in the result: until the engine
 * counts those paths too, such a result shows missing topics and relevance only when the count
 * did find a topic in its own claims.
 */
export function topicsCounted(result: SearchResult): boolean {
  const { metrics, via, passage } = result;
  if (!metrics) return false;
  return metrics.covers.length > 0 || (!via && !passage);
}

/** The topics the card may call missing: none while the count does not describe the result. */
export function missingTopics(result: SearchResult): string[] {
  return topicsCounted(result) ? (result.metrics?.missing ?? []) : [];
}

/**
 * The bars of the card, in the report's order. Confidence joins as a fourth bar once the engine
 * has calibrated it; while it is null the card says nothing and the report says so in words.
 */
export function metricBars(result: SearchResult): MetricBar[] {
  const { metrics } = result;
  if (!metrics) return [];
  const { filled, of } = metrics.completeness;
  const bars = [
    share("Relevance", topicsCounted(result) ? metrics.relevance : null),
    share("Evidence", metrics.evidence),
    { label: "Completeness" as const, value: `${filled}/${of}`, now: filled, max: of },
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
