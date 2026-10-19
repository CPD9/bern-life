// Reports live only in the browser that made them until shared storage exists: each is a frozen
// copy of the answer, kept until the player removes it. Storage can be missing or throw (private
// windows, blocked site data), so every access is guarded, and a stored response is parsed against
// the contract again before it is rendered.
import { parseSearchResponse } from "@/infrastructure/contract";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

export type StoredReport = {
  readonly response: SearchResponse;
  readonly madeAt: string;
  readonly fixture: boolean;
};

type ReportStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const keyPrefix = "bernlife.report.";

export type ListedReport = { readonly id: string; readonly report: StoredReport };

export type ReportStore = {
  save(report: StoredReport): string | null;
  load(id: string): StoredReport | null;
  /** Every readable report in this browser, newest first; broken entries are left out. */
  list(): ListedReport[];
  /** Drops the report from this browser; false when storage could not be reached. */
  remove(id: string): boolean;
};

function parseStored(raw: string | null): StoredReport | null {
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
}

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
      try {
        return parseStored(storage().getItem(keyPrefix + id));
      } catch {
        return null;
      }
    },
    list: () => {
      const listed: ListedReport[] = [];
      try {
        const keys = storage();
        for (let index = 0; index < keys.length; index++) {
          const key = keys.key(index);
          if (!key?.startsWith(keyPrefix)) continue;
          const report = parseStored(keys.getItem(key));
          if (report) listed.push({ id: key.slice(keyPrefix.length), report });
        }
      } catch {
        return [];
      }
      return listed.sort((a, b) => b.report.madeAt.localeCompare(a.report.madeAt));
    },
    remove: (id) => {
      try {
        storage().removeItem(keyPrefix + id);
        return true;
      } catch {
        return false;
      }
    },
  };
}

export const browserReports: ReportStore = createReportStore(
  () => window.localStorage,
  () => crypto.randomUUID(),
);
