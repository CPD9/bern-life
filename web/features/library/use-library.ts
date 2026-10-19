"use client";

import { useSyncExternalStore } from "react";
import type { LibraryItem } from "./library-items";
import type { LibraryStore } from "./library-store";

const nothingKept: readonly LibraryItem[] = [];

/** The kept items; empty during server rendering, then what this device holds. */
export function useLibraryItems(store: LibraryStore): readonly LibraryItem[] {
  return useSyncExternalStore(store.subscribe, store.get, () => nothingKept);
}
