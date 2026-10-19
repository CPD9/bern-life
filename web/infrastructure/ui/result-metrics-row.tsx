import type { SearchResult } from "@/infrastructure/claims";
import { type MetricBar, metricBars, metricMeanings, noveltyChip } from "./result-metrics";

// The number sits next to its label and the track below, so a card reads in a glance: three short
// bars, then the topics as chips. The meanings fold away under one closed line.
function Bar({ label, value, now, max }: MetricBar) {
  return (
    <li className="flex w-22 flex-col gap-1">
      <span className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted">{label}</span>
        <strong className="tabular-nums">{value}</strong>
      </span>
      {now === null ? (
        <span aria-hidden="true" className="bg-chip h-1.5 rounded-pill" />
      ) : (
        <span
          role="meter"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={now}
          aria-valuetext={value}
          className="bg-chip h-1.5 overflow-hidden rounded-pill"
        >
          <span
            className="bg-primary block h-full rounded-pill"
            style={{ width: `${(100 * now) / max}%` }}
          />
        </span>
      )}
    </li>
  );
}

const chip = "rounded-pill px-2.5 py-0.5 text-xs font-bold";

export function ResultMetricsRow({ metrics }: { metrics: SearchResult["metrics"] }) {
  if (!metrics) return null;
  const bars = metricBars(metrics);
  const novelty = noveltyChip(metrics);
  const topics = metrics.covers.length > 0 || metrics.missing.length > 0 || novelty !== null;
  return (
    <section aria-label="How well this result fits" className="flex flex-col gap-2 text-sm">
      <ul aria-label="Scores" className="flex flex-wrap gap-x-4 gap-y-2">
        {bars.map((bar) => (
          <Bar key={bar.label} {...bar} />
        ))}
      </ul>
      {topics && (
        <ul aria-label="Topics" className="flex flex-wrap gap-1.5">
          {metrics.covers.map((topic) => (
            <li key={`covers-${topic}`} className={`bg-primary text-primary-ink ${chip}`}>
              <span aria-hidden="true">✓ </span>
              {topic}
              <span className="sr-only"> (found)</span>
            </li>
          ))}
          {metrics.missing.map((topic) => (
            <li key={`missing-${topic}`} className={`bg-chip text-muted ${chip}`}>
              {topic} missing
            </li>
          ))}
          {novelty && <li className={`bg-chip text-muted ${chip}`}>{novelty}</li>}
        </ul>
      )}
      <details className="text-xs">
        <summary className="text-muted cursor-pointer font-bold">What do these mean?</summary>
        <ul className="text-muted mt-1.5 flex flex-col gap-1">
          {bars.map(({ label }) => (
            <li key={label}>
              <strong className="text-ink">{label}</strong>: {metricMeanings[label]}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
