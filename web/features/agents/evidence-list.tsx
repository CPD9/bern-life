import type { EvidenceRow } from "./skill-evidence";

// One row per number: what it counts, the value as given, and a link to where it comes from.
export function EvidenceList({ rows, label }: { rows: readonly EvidenceRow[]; label: string }) {
  if (rows.length === 0) return null;
  return (
    <dl aria-label={label} className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.label} className="bg-chip flex flex-col gap-0.5 rounded-xl px-3 py-2">
          <dt className="text-muted text-sm">{row.label}</dt>
          <dd className="font-bold tabular-nums">
            {row.fixture && (
              <>
                <span className="bg-warn-bg text-warn-ink rounded-pill px-2 py-0.5 text-xs font-extrabold tracking-widest">
                  FIXTURE
                </span>{" "}
              </>
            )}
            {row.value}
          </dd>
          <dd className="text-muted text-xs break-words">
            Source:{" "}
            <a
              href={row.source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {row.source.name}
            </a>
          </dd>
        </div>
      ))}
    </dl>
  );
}
