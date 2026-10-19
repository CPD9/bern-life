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
export type MetricRow = { readonly label: MetricLabel; readonly value: string };

type Metrics = NonNullable<SearchResult["metrics"]>;

export function percent(value: number | null): string {
  return value === null ? notComputed : `${Math.round(value * 100)}%`;
}

/** The four numbers, in the report's order; none when the engine sent no metrics. */
export function metricRows(metrics: Metrics | null | undefined): MetricRow[] {
  if (!metrics) return [];
  return [
    { label: "Relevance", value: percent(metrics.relevance) },
    { label: "Evidence", value: percent(metrics.evidence) },
    {
      label: "Completeness",
      value: `${metrics.completeness.filled} of ${metrics.completeness.of}`,
    },
    {
      label: "Confidence",
      value: metrics.confidence === null ? "not yet calibrated" : percent(metrics.confidence),
    },
  ];
}

/** Whether the result brings a unit not seen above it, and which topics it adds. */
export function noveltyTags(metrics: Metrics | null | undefined): string[] {
  if (!metrics) return [];
  const tags = [metrics.novelty.new_unit ? "New unit" : "Unit already above"];
  if (metrics.novelty.adds.length > 0) tags.push(`Adds: ${metrics.novelty.adds.join(", ")}`);
  return tags;
}
