"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { formatBernShortDate, formatBernTime } from "@/infrastructure/bern-time";
import { reportPath } from "./open-report";
import { ReportDocument } from "./report-document";
import { buildReport } from "./report-model";
import { type ListedReport, type ReportStore, browserReports } from "./report-store";

type ReportsAppProps = {
  /** The report to show; null shows the newest. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Opens the Navigator, where reports are made. */
  onAsk: () => void;
  store?: ReportStore;
};

// The match reports kept in this browser, read again on every render so a report made in the
// Navigator shows up as soon as this window is drawn. Each is a copy that does not change, so the
// player can remove it here.
export function ReportsApp({
  selectedId,
  onSelect,
  onAsk,
  store = browserReports,
}: ReportsAppProps) {
  const listed = store.list();
  const selected = listed.find(({ id }) => id === selectedId) ?? listed[0];
  const [status, setStatus] = useState("");
  // Storage is read on render, so a removal only has to draw the window again.
  const [, reread] = useReducer((count: number) => count + 1, 0);
  const removeButton = useRef<HTMLButtonElement>(null);
  const navigatorButton = useRef<HTMLButtonElement>(null);
  const focusAfterRemove = useRef(false);

  // After the render without the removed report: Remove now stands for the next one, and once
  // none is left the way to make a new one takes focus.
  useEffect(() => {
    if (!focusAfterRemove.current) return;
    focusAfterRemove.current = false;
    (removeButton.current ?? navigatorButton.current)?.focus();
  });

  function remove(removed: ListedReport) {
    if (!store.remove(removed.id)) {
      setStatus("This browser blocks storage, so the report could not be removed.");
      return;
    }
    const index = listed.indexOf(removed);
    const next = listed[index + 1] ?? listed[index - 1];
    if (next) onSelect(next.id);
    focusAfterRemove.current = true;
    setStatus(`Removed the report on “${removed.report.response.query}”`);
    reread();
  }

  const report =
    selected &&
    buildReport(selected.report.response, selected.report.madeAt, selected.report.fixture);

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {status}
      </p>
      {!selected ? (
        <>
          <p>
            No match reports yet. Ask the Navigator or bring a brief, then choose “Make report”
            under the answer.
          </p>
          <button
            ref={navigatorButton}
            type="button"
            onClick={onAsk}
            className="bg-primary text-primary-ink rounded-pill self-start px-5 py-2 font-bold"
          >
            Open the Navigator
          </button>
        </>
      ) : (
        <>
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
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            <a
              href={reportPath(selected.id)}
              target="_blank"
              rel="noopener"
              className="text-primary font-bold underline"
            >
              Open as a page to save as PDF
            </a>
            <button
              ref={removeButton}
              type="button"
              onClick={() => remove(selected)}
              aria-label={`Remove the report on “${selected.report.response.query}”`}
              className="text-primary font-bold underline"
            >
              Remove
            </button>
          </div>
          {report ? (
            <ReportDocument report={report} />
          ) : (
            <p>This answer has no results, so there is nothing to report.</p>
          )}
        </>
      )}
    </div>
  );
}
