// Reports live only in the browser that made them until shared storage exists. Storage can be
// missing or throw (private windows, blocked site data), so every access is guarded, and a stored
// response is parsed against the contract again before it is rendered.
import { parseSearchResponse } from "@/infrastructure/contract";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

export type StoredReport = {
  readonly response: SearchResponse;
  readonly madeAt: string;
  readonly fixture: boolean;
};

type ReportStorage = Pick<Storage, "getItem" | "setItem">;

const keyPrefix = "bernlife.report.";

export type ReportStore = {
  save(report: StoredReport): string | null;
  load(id: string): StoredReport | null;
};

export function createReportStore(storage: () => ReportStorage, newId: () => string): ReportStore {
  return {
    save: (report) => {
      const id = newId();
      try {
        storage().setItem(keyPrefix + id, JSON.stringify(report));
        return id;
      } catch {
        return null;
      }
    },
    load: (id) => {
      let raw: string | null;
      try {
        raw = storage().getItem(keyPrefix + id);
      } catch {
        return null;
      }
      if (raw === null) return null;
      try {
        const { response, madeAt, fixture } = JSON.parse(raw) as Record<string, unknown>;
        const parsed = parseSearchResponse(response);
        if (parsed === null || typeof madeAt !== "string" || typeof fixture !== "boolean") {
          return null;
        }
        return { response: parsed, madeAt, fixture };
      } catch {
        return null;
      }
    },
  };
}

export const browserReports: ReportStore = createReportStore(
  () => window.localStorage,
  () => crypto.randomUUID(),
);
