import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { type ReportStore, browserReports } from "./report-store";

/** Saves the answer on screen and opens its report in a new tab; false when storage is blocked. */
export function openReport(
  response: SearchResponse,
  fixture: boolean,
  store: ReportStore = browserReports,
): boolean {
  const id = store.save({ response, madeAt: new Date().toISOString(), fixture });
  if (id === null) return false;
  window.open(`/report/${id}`, "_blank", "noopener");
  return true;
}
