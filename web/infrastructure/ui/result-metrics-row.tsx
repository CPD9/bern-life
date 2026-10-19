import type { SearchResult } from "@/infrastructure/claims";
import { metricMeanings, metricRows, noveltyTags } from "./result-metrics";

/** The result's metrics under its name: each label carries its meaning as a tooltip. */
export function ResultMetricsRow({ metrics }: { metrics: SearchResult["metrics"] }) {
  const rows = metricRows(metrics);
  if (!metrics || rows.length === 0) return null;
  const tags = noveltyTags(metrics);
  return (
    <section aria-label="How well this result fits" className="flex flex-col gap-1.5 text-sm">
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {rows.map(({ label, value }) => (
          <li key={label} title={metricMeanings[label]}>
            <span className="text-muted">{label} </span>
            <strong>{value}</strong>
          </li>
        ))}
      </ul>
      {(metrics.covers.length > 0 || metrics.missing.length > 0) && (
        <p className="text-muted">
          {metrics.covers.length > 0 && `Covers: ${metrics.covers.join(", ")}`}
          {metrics.covers.length > 0 && metrics.missing.length > 0 && " · "}
          {metrics.missing.length > 0 && `Missing: ${metrics.missing.join(", ")}`}
        </p>
      )}
      <ul aria-label="What this result adds" className="flex flex-wrap gap-1">
        {tags.map((tag) => (
          <li key={tag} className="bg-chip rounded-pill px-2.5 py-0.5 text-xs font-bold">
            {tag}
          </li>
        ))}
      </ul>
    </section>
  );
}
