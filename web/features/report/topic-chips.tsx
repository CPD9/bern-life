import { notComputed } from "./report-model";

type TopicChipsProps = { covers: readonly string[]; missing: readonly string[] };

export function TopicChips({ covers, missing }: TopicChipsProps) {
  if (covers.length === 0 && missing.length === 0) {
    return <p className="text-muted text-sm">Topics: {notComputed}</p>;
  }
  return (
    <ul aria-label="Topics" className="flex flex-wrap gap-1.5">
      {covers.map((topic) => (
        <li
          key={`covers-${topic}`}
          className="bg-primary text-primary-ink rounded-pill px-3 py-1 text-sm font-bold"
        >
          <span aria-hidden="true">✓ </span>
          {topic}
          <span className="sr-only"> (found)</span>
        </li>
      ))}
      {missing.map((topic) => (
        <li
          key={`missing-${topic}`}
          className="border-panel-border text-muted rounded-pill border border-dashed px-3 py-1 text-sm line-through"
        >
          {topic}
          <span className="sr-only"> (not found)</span>
        </li>
      ))}
    </ul>
  );
}
