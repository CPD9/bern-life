import { formatMillis } from "@/infrastructure/number-format";
import type { ModelNumbers } from "@/infrastructure/numbers";

// One card per role rather than a table, so the six columns still read at phone width.
export function ModelNumbersView({ models }: { models: readonly ModelNumbers[] }) {
  if (models.length === 0) {
    return <p>Apertus was not called on this snapshot, so there are no numbers to show.</p>;
  }
  return (
    <ul aria-label="Models by role" className="flex flex-col gap-3">
      {models.map((model) => (
        <li key={`${model.role} ${model.model}`} className="bg-chip rounded-2xl p-4">
          <h4 className="font-extrabold">{model.role}</h4>
          <p className="text-muted text-sm break-all">{model.model}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Cell label="Calls" value={String(model.calls)} />
            <Cell label="OK" value={String(model.ok)} />
            <Cell label="Median latency" value={formatMillis(model.median_ms)} />
            <Cell label="p95 latency" value={formatMillis(model.p95_ms)} />
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="font-bold tabular-nums">{value}</dd>
    </div>
  );
}
