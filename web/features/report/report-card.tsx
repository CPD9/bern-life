import { fragmentUrl } from "@/infrastructure/text-fragment";
import { CorrectionNote } from "@/infrastructure/ui/claim-evidence";
import { highlightParts } from "./highlight";
import type { ReportCard as Card } from "./report-model";
import { TopicChips } from "./topic-chips";

const kindLabels: Record<Card["kind"], string> = {
  person: "Person",
  unit: "Unit",
  project: "Project",
  infrastructure: "Infrastructure",
  call: "Funding call",
  service: "Service",
  space: "Space",
};

const fetchedFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "Europe/Zurich",
});

const metricMeanings = {
  Relevance: "Share of your topics found in this result's verified claims",
  Evidence: "How directly the public pages tie this result to the topics",
  Completeness: "Profile fields the public pages fill, out of five",
  Confidence: "How often results like this were right on hand-checked questions",
} as const;

function pageLabel(pageUrl: string): string {
  const url = new URL(pageUrl);
  return `${url.host}${url.pathname === "/" ? "" : url.pathname}`;
}

function Metric({ label, value }: { label: keyof typeof metricMeanings; value: string }) {
  return (
    <div title={metricMeanings[label]}>
      <dt className="text-muted inline">{label} </dt>
      <dd className="inline font-bold">{value}</dd>
    </div>
  );
}

export function ReportCard({ card, highlightTerms }: { card: Card; highlightTerms: string[] }) {
  return (
    <article className="rounded-panel bg-panel border-panel-border flex break-inside-avoid flex-col gap-3 border p-5 print:rounded-xl">
      <header className="flex items-start gap-3">
        <span className="bg-chip-selected text-chip-selected-ink rounded-pill flex size-8 shrink-0 items-center justify-center text-sm font-extrabold">
          {card.rank}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-muted text-xs font-bold tracking-wide uppercase">
            {kindLabels[card.kind]}
          </p>
          <h3 className="text-lg font-extrabold">{card.name}</h3>
          <p className="text-muted text-sm">
            {card.role} · {card.unit}
          </p>
        </div>
        {card.novelty.length > 0 && (
          <ul aria-label="What this result adds" className="flex flex-wrap justify-end gap-1">
            {card.novelty.map((tag) => (
              <li key={tag} className="bg-chip rounded-pill px-2.5 py-0.5 text-xs font-bold">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </header>

      <TopicChips covers={card.covers} missing={card.missing} />

      {card.proof ? (
        <>
          <figure className="bg-chip flex flex-col gap-1.5 rounded-2xl p-3 text-sm">
            <blockquote>
              “
              {highlightParts(card.proof.span, highlightTerms).map((part, index) =>
                part.marked ? (
                  <mark key={index} className="bg-mark text-ink rounded font-bold">
                    {part.text}
                  </mark>
                ) : (
                  <span key={index}>{part.text}</span>
                ),
              )}
              ”
            </blockquote>
            <figcaption className="text-muted">
              <a
                href={fragmentUrl(card.proof.pageUrl, card.proof.span)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ink break-all underline"
              >
                {pageLabel(card.proof.pageUrl)}
              </a>
              {card.proof.fetchedAt && (
                <>, fetched {fetchedFormat.format(new Date(card.proof.fetchedAt))}</>
              )}
            </figcaption>
          </figure>
          {/* Paper cannot open it; the legend says the same in print. */}
          <div className="text-sm print:hidden">
            <CorrectionNote fetchedAt={card.proof.fetchedAt} />
          </div>
        </>
      ) : (
        <p className="text-muted text-sm">No sentence to quote.</p>
      )}

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <Metric label="Relevance" value={card.relevance} />
        <Metric label="Evidence" value={card.evidence} />
        <Metric label="Completeness" value={card.completeness} />
        <Metric label="Confidence" value={card.confidence} />
      </dl>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {card.details.map(({ label, value }) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
