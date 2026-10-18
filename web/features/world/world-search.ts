// The world's search state, owned outside React so the app can drive it from the Navigator without
// one feature importing another: begin() when a query is sent, showResults() when the answer is in,
// clear() to put the city back to rest.

import { useSyncExternalStore } from "react";
import { type SearchResponse } from "@/infrastructure/contract-types.generated";

export type WorldSearchState =
  | { readonly status: "idle" }
  | { readonly status: "searching" }
  | { readonly status: "results"; readonly response: SearchResponse };

export type WorldSearch = {
  begin: () => void;
  showResults: (response: SearchResponse) => void;
  clear: () => void;
  subscribe: (listener: () => void) => () => void;
  read: () => WorldSearchState;
};

const IDLE: WorldSearchState = { status: "idle" };
const SEARCHING: WorldSearchState = { status: "searching" };

export function createWorldSearch(): WorldSearch {
  let state = IDLE;
  const listeners = new Set<() => void>();
  function set(next: WorldSearchState) {
    state = next;
    for (const listener of listeners) listener();
  }
  return {
    begin: () => set(SEARCHING),
    showResults: (response) => set({ status: "results", response }),
    clear: () => set(IDLE),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read: () => state,
  };
}

/** The store the app drives; the world reads it. */
export const worldSearch = createWorldSearch();

export function useWorldSearch(store: WorldSearch = worldSearch): WorldSearchState {
  return useSyncExternalStore(store.subscribe, store.read, () => IDLE);
}
