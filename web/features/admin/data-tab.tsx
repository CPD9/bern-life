import type { AdminFlagged, SourcesList } from "@/infrastructure/contract-types.generated";
import { EMPTY_TEXT, count, formatFetched, plural } from "./admin-text";
import { Figure, Section } from "./admin-layout";

type DataTabProps = { sources: SourcesList | null; flagged: AdminFlagged };

// What the engine holds: each source with its counts and newest fetch, then the person profiles
// whose name reads as a company, each with the page to check it against. Sources is null while
// still loading or refused; the flagged list has its own refusal screen, so here it is always there.
export function DataTab({ sources, flagged }: DataTabProps) {
  return (
    <>
      <Section title="Sources">
        {sources === null ? (
          <p className="text-muted text-sm">The sources are not loaded.</p>
        ) : sources.sources.length === 0 ? (
          <p className="text-muted text-sm">{EMPTY_TEXT.noSources}</p>
        ) : (
          <ul aria-label="Sources" className="flex flex-col gap-3">
            {sources.sources.map((source) => (
              <li key={source.id} className="bg-chip flex flex-col gap-2 rounded-2xl p-4">
                <h4 className="font-extrabold">{source.name}</h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Figure label="Profiles" value={count(source.profiles)} />
                  <Figure label="Pages" value={count(source.pages)} />
                  <Figure label="Sites" value={count(source.hosts.length)} />
                  <Figure
                    label="Newest page fetched"
                    value={
                      source.newest_fetched_at === null
                        ? "No pages in this snapshot"
                        : formatFetched(source.newest_fetched_at)
                    }
                  />
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Names to check">
        <p>
          {flagged.people.length === 0
            ? EMPTY_TEXT.noFlagged(flagged.checked)
            : `${count(flagged.people.length)} of ${plural(flagged.checked, "person profile")} have a name shaped like a company or group. Open the page and check who it names.`}
        </p>
        {flagged.people.length > 0 && (
          <ul aria-label="Names to check" className="flex flex-col">
            {flagged.people.map((person) => (
              <li
                key={person.id}
                className="border-panel-border flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-3 last:border-b-0"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-bold break-words">{person.name}</span>
                  <span className="text-muted text-sm">
                    {person.reason} · {person.source_name}
                  </span>
                </span>
                <a
                  href={person.page_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink font-bold underline"
                >
                  Open page<span className="sr-only"> of {person.name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
