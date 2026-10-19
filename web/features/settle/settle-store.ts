// The chosen plot lives on this device only. The office route on the server saves plot, layout and
// visit visibility together, and nothing here knows the other two, so writing the plot there would
// overwrite them. Storage can be missing or throw (private windows, blocked site data), so every
// access is guarded and memory is the fallback.

import { type Plot, plotById } from "./plots";

export const settleKey = "bernlife.office-plot";

type PlotStorage = Pick<Storage, "getItem" | "setItem">;

export type SettleStore = {
  get(): Plot | null;
  set(plot: Plot): void;
  subscribe(listener: () => void): () => void;
};

function readPlot(raw: string | null): Plot | null {
  if (raw === null) return null;
  try {
    const stored: unknown = JSON.parse(raw);
    const id = typeof stored === "object" && stored !== null && "id" in stored ? stored.id : null;
    return plotById(typeof id === "string" ? id : null);
  } catch {
    return null;
  }
}

export function createSettleStore(storage: () => PlotStorage): SettleStore {
  let current: Plot | null;
  try {
    current = readPlot(storage().getItem(settleKey));
  } catch {
    current = null;
  }
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (plot) => {
      current = plot;
      try {
        storage().setItem(settleKey, JSON.stringify({ id: plot.id }));
      } catch {
        // Kept in memory for this visit only.
      }
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let browser: SettleStore | undefined;

export function browserSettleStore(): SettleStore {
  browser ??= createSettleStore(() => window.localStorage);
  return browser;
}
