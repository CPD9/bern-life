// The Library lives in localStorage for now, per device, under one key. Storage can be missing or
// throw (private windows, blocked site data), so every access is guarded and memory is the
// fallback; a stored value that does not parse starts the Library empty rather than breaking it.
import { type LibraryItem, addItem, parseItems, removeItem } from "./library-items";

export const libraryKey = "bernlife.library.items";

type LibraryStorage = Pick<Storage, "getItem" | "setItem">;

export type LibraryStore = {
  get(): readonly LibraryItem[];
  /** True when the item was new; false when it was already kept. */
  save(item: LibraryItem): boolean;
  remove(item: LibraryItem): void;
  subscribe(listener: () => void): () => void;
};

function read(storage: () => LibraryStorage): readonly LibraryItem[] {
  try {
    const raw = storage().getItem(libraryKey);
    return raw === null ? [] : parseItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function createLibraryStore(storage: () => LibraryStorage): LibraryStore {
  let current = read(storage);
  const listeners = new Set<() => void>();

  function set(next: readonly LibraryItem[]) {
    current = next;
    try {
      storage().setItem(libraryKey, JSON.stringify(next));
    } catch {
      // Kept in memory for this visit only.
    }
    for (const listener of listeners) listener();
  }

  return {
    get: () => current,
    save: (item) => {
      const next = addItem(current, item);
      if (next.length === current.length) return false;
      set(next);
      return true;
    },
    remove: (item) => set(removeItem(current, item)),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let browserStore: LibraryStore | undefined;

/** One store per page, created on first use so nothing touches window during server rendering. */
export function browserLibrary(): LibraryStore {
  browserStore ??= createLibraryStore(() => window.localStorage);
  return browserStore;
}
