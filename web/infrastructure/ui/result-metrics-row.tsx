import type { SearchResult } from "@/infrastructure/claims";
import {
  type MetricBar,
  metricBars,
  metricMeanings,
  missingTopics,
  noveltyChip,
} from "./result-metrics";

// The number sits next to its label and the track below, so a card reads in a glance: three short
// bars, then the topics as chips. The meanings fold away under one closed line.
// A bar is never narrower than 88 px, which holds "Completeness 5/5" at 12 px, and never wider
// than 128 px. Three bars at their narrowest with their two 12 px gaps are 288 px, inside the
// 310 px of card content on the 400 px phone, so the row holds one line down to 390 px.
function Bar({ label, value, now, max }: MetricBar) {
  return (
    <li className="flex min-w-22 max-w-32 flex-1 flex-col gap-1">
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

export function ResultMetricsRow({ result }: { result: SearchResult }) {
  const { metrics } = result;
  if (!metrics) return null;
  const bars = metricBars(result);
  const missing = missingTopics(result);
  const novelty = noveltyChip(metrics);
  const topics = metrics.covers.length > 0 || missing.length > 0 || novelty !== null;
  return (
    <section aria-label="How well this result fits" className="flex flex-col gap-2 text-sm">
      <ul aria-label="Scores" className="flex flex-wrap gap-x-3 gap-y-2">
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
          {missing.map((topic) => (
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
