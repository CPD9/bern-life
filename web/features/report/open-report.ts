import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { type ReportStore, browserReports } from "./report-store";

export type ReportDeps = {
  readonly store: ReportStore;
  readonly events: AppEventSink;
  /** Shows the saved report: a new tab by default, the Reports window on the office computer. */
  readonly open: (id: string) => void;
};

export function reportPath(id: string): string {
  return `/report/${id}`;
}

export const browserReportDeps: ReportDeps = {
  store: browserReports,
  events: appEvents,
  open: (id) => void window.open(reportPath(id), "_blank", "noopener"),
};

/** Saves the answer on screen and opens its report; false when storage is blocked. */
export function openReport(
  response: SearchResponse,
  fixture: boolean,
  deps: ReportDeps = browserReportDeps,
): boolean {
  const id = deps.store.save({ response, madeAt: new Date().toISOString(), fixture });
  if (id === null) return false;
  deps.open(id);
  deps.events.emit("report_made");
  return true;
}
