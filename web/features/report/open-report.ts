import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { type ReportStore, browserReports } from "./report-store";

export type ReportDeps = {
  readonly store: ReportStore;
  readonly events: AppEventSink;
  readonly open: (path: string) => void;
};

const browserDeps: ReportDeps = {
  store: browserReports,
  events: appEvents,
  open: (path) => void window.open(path, "_blank", "noopener"),
};

/** Saves the answer on screen and opens its report in a new tab; false when storage is blocked. */
export function openReport(
  response: SearchResponse,
  fixture: boolean,
  deps: ReportDeps = browserDeps,
): boolean {
  const id = deps.store.save({ response, madeAt: new Date().toISOString(), fixture });
  if (id === null) return false;
  deps.open(`/report/${id}`);
  deps.events.emit("report_made");
  return true;
}
