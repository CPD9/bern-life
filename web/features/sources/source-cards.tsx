import { type SourceSummary, formatFetchedDate, siteRoot } from "./sources-list";

export function SourceCards({ sources }: { sources: readonly SourceSummary[] }) {
  if (sources.length === 0) return <p>No sources are in this snapshot.</p>;
  return (
    <ul aria-label="Sources" className="flex flex-col gap-3">
      {sources.map((source) => (
        <li key={source.id} className="bg-chip flex flex-col gap-2 rounded-2xl p-4">
          <h4 className="font-extrabold">{source.name}</h4>
          <ul aria-label={`Sites of ${source.name}`} className="flex flex-wrap gap-x-4 gap-y-1">
            {source.hosts.map((host) => (
              <li key={host}>
                <a
                  href={siteRoot(host)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink font-bold break-all underline"
                >
                  {host}
                </a>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            <Cell
              label="Kinds"
              value={source.kinds.length > 0 ? source.kinds.join(", ") : "none"}
            />
            <Cell label="Pages" value={String(source.pages)} />
            <Cell label="Profiles" value={String(source.profiles)} />
            <div className="flex flex-col">
              <dt className="text-muted text-sm">Newest page fetched</dt>
              <dd className="font-bold">
                {source.newest_fetched_at === null ? (
                  "No pages in this snapshot"
                ) : (
                  <time dateTime={source.newest_fetched_at}>
                    {formatFetchedDate(source.newest_fetched_at)}
                  </time>
                )}
              </dd>
            </div>
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
      <dd className="font-bold break-words tabular-nums">{value}</dd>
    </div>
  );
}
