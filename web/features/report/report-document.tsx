import { ReportCard } from "./report-card";
import { ReportLegend } from "./report-legend";
import type { MatchReport } from "./report-model";

const madeAtFormat = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Europe/Zurich",
});

export function ReportDocument({ report }: { report: MatchReport }) {
  const madeAt = madeAtFormat.format(new Date(report.madeAt));
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-muted text-sm font-bold tracking-wide uppercase">
          Bern Life · Match report
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">{report.query}</h1>
        <p className="text-muted text-sm">
          Made {madeAt} (Bern) · {report.modeLabels.join(" · ")}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-extrabold">What was asked</h2>
        {report.needs.length > 0 && (
          <ol className="flex flex-col gap-2">
            {report.needs.map((need) => (
              <li key={need.term} className="bg-chip rounded-2xl p-3 text-sm">
                <p className="font-bold">{need.term}</p>
                <p className="text-muted">From the brief: “{need.span}”</p>
              </li>
            ))}
          </ol>
        )}
        <p className="text-sm">
          <span className="text-muted">Topics: </span>
          {report.topics.length > 0 ? report.topics.join(", ") : "—"}
        </p>
        {report.addedWordings.length > 0 && (
          <p className="text-sm">
            <span className="text-muted">Added by the system, to widen the search: </span>
            {report.addedWordings.map((wording) => `${wording.term} (${wording.kind})`).join(", ")}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-extrabold">Matches</h2>
        <p className="text-muted text-sm italic">
          Ordered by search match · the numbers describe each result, they don&apos;t rank it.
        </p>
        <ol className="flex flex-col gap-4">
          {report.cards.map((card) => (
            <li key={`${card.rank}-${card.name}`}>
              <ReportCard card={card} highlightTerms={report.highlightTerms} />
            </li>
          ))}
        </ol>
      </section>

      <ReportLegend />

      <footer className="text-muted border-panel-border border-t pt-3 text-xs">
        Snapshot {report.snapshot} · made {madeAt} (Bern) · {report.modeLabels.join(" · ")} · Built
        only from verified claims on public pages; contact goes through each source page.
      </footer>
    </article>
  );
}
