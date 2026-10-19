import type { EvidenceSource } from "./skills";
import type { SkillEvidence } from "./skill-evidence";

function Source({ source }: { source: EvidenceSource }) {
  if (source.href === undefined) return <>{source.name}</>;
  return (
    <a href={source.href} target="_blank" rel="noopener noreferrer" className="underline">
      {source.name}
    </a>
  );
}

// One row per number: what it counts, the value as given, and where it comes from.
export function EvidenceList({ evidence, label }: { evidence: SkillEvidence; label: string }) {
  return (
    <>
      {evidence.rows.length > 0 && (
        <dl aria-label={label} className="flex flex-col gap-2">
          {evidence.rows.map((row) => (
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
                Source: <Source source={row.source} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {evidence.note !== null && <p className="text-muted text-sm">{evidence.note}</p>}
    </>
  );
}
