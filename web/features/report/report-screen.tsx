"use client";

import { useSyncExternalStore } from "react";
import { ReportDocument } from "./report-document";
import { buildReport } from "./report-model";
import { type ReportStore, type StoredReport, browserReports } from "./report-store";

const loaded = new Map<string, StoredReport | null>();

function loadOnce(store: ReportStore, id: string): StoredReport | null {
  if (!loaded.has(id)) loaded.set(id, store.load(id));
  return loaded.get(id) ?? null;
}

const noChanges = () => () => undefined;

type ReportScreenProps = { id: string; store?: ReportStore };

export function ReportScreen({ id, store = browserReports }: ReportScreenProps) {
  // undefined on the server and in the first render: storage exists only in the browser.
  const stored = useSyncExternalStore(
    noChanges,
    () => loadOnce(store, id),
    () => undefined,
  );
  if (stored === undefined) return null;
  if (stored === null) {
    return (
      <p>
        This report is not in this browser: it was removed, or made in another one. Reports are kept
        only in the browser that made them, until shared links arrive.
      </p>
    );
  }
  const report = buildReport(stored.response, stored.madeAt, stored.fixture);
  if (report === null) {
    return <p>This answer has no results, so there is nothing to report.</p>;
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-primary text-primary-ink rounded-pill px-5 py-2 font-bold"
        >
          Save as PDF
        </button>
        <p className="text-muted self-center text-sm">
          Opens the print dialog; choose “Save as PDF”.
        </p>
      </div>
      <ReportDocument report={report} />
    </div>
  );
}
