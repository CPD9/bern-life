"use client";

import { formatBernShortDate, formatBernTime } from "@/infrastructure/bern-time";
import { reportPath } from "./open-report";
import { ReportDocument } from "./report-document";
import { buildReport } from "./report-model";
import { type ReportStore, browserReports } from "./report-store";

type ReportsAppProps = {
  /** The report to show; null shows the newest. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Opens the Navigator, where reports are made. */
  onAsk: () => void;
  store?: ReportStore;
};

// The match reports kept in this browser, read again on every render so a report made in the
// Navigator shows up as soon as this window is drawn.
export function ReportsApp({
  selectedId,
  onSelect,
  onAsk,
  store = browserReports,
}: ReportsAppProps) {
  const listed = store.list();
  const selected = listed.find(({ id }) => id === selectedId) ?? listed[0];

  if (!selected) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p>
          No match reports yet. Ask the Navigator or bring a brief, then choose “Make report” under
          the answer.
        </p>
        <button
          type="button"
          onClick={onAsk}
          className="bg-primary text-primary-ink rounded-pill px-5 py-2 font-bold"
        >
          Open the Navigator
        </button>
      </div>
    );
  }

  const report = buildReport(
    selected.report.response,
    selected.report.madeAt,
    selected.report.fixture,
  );

  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Your reports">
        <ul className="flex flex-col gap-1">
          {listed.map(({ id, report: stored }) => {
            const madeAt = new Date(stored.madeAt);
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={id === selected.id ? "true" : undefined}
                  onClick={() => onSelect(id)}
                  className={`flex w-full flex-wrap items-center gap-x-2 rounded-xl px-3 py-2 text-left ${
                    id === selected.id ? "bg-chip font-bold" : ""
                  }`}
                >
                  <span className="flex-1">{stored.response.query}</span>
                  <span className="text-muted text-sm tabular-nums">
                    {formatBernShortDate(madeAt)} {formatBernTime(madeAt)}
                  </span>
                  {stored.fixture && (
                    <span className="bg-chip text-muted rounded-pill px-2 text-xs font-bold">
                      FIXTURE
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <a
        href={reportPath(selected.id)}
        target="_blank"
        rel="noopener"
        className="text-primary self-start font-bold underline"
      >
        Open as a page to save as PDF
      </a>
      {report ? (
        <ReportDocument report={report} />
      ) : (
        <p>This answer has no results, so there is nothing to report.</p>
      )}
    </div>
  );
}
