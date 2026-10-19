// The Library lives in localStorage for now, per device, under one key. Storage can be missing or
// throw (private windows, blocked site data), so every access is guarded and memory is the
// fallback; a stored value that does not parse starts the Library empty rather than breaking it.
// Another tab may have saved since this one last read, so every change starts from storage.
import { type LibraryItem, addItem, parseItems, removeItem } from "./library-items";

export const libraryKey = "bernlife.library.items";

type LibraryStorage = Pick<Storage, "getItem" | "setItem">;

export type LibraryStore = {
  get(): readonly LibraryItem[];
  /** True when the item was new; false when it was already kept. */
  save(item: LibraryItem): boolean;
  remove(item: LibraryItem): void;
  /** Reads storage again, after another tab changed it. */
  refresh(): void;
  subscribe(listener: () => void): () => void;
};

/** What storage holds, or null when storage cannot be read. */
function read(storage: () => LibraryStorage): LibraryItem[] | null {
  let raw: string | null;
  try {
    raw = storage().getItem(libraryKey);
  } catch {
    return null;
  }
  if (raw === null) return [];
  try {
    return parseItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function createLibraryStore(storage: () => LibraryStorage): LibraryStore {
  let current: readonly LibraryItem[] = read(storage) ?? [];
  const listeners = new Set<() => void>();

  function notify() {
    for (const listener of listeners) listener();
  }

  function latest(): readonly LibraryItem[] {
    return read(storage) ?? current;
  }

  function set(next: readonly LibraryItem[]) {
    current = next;
    try {
      storage().setItem(libraryKey, JSON.stringify(next));
    } catch {
      // Kept in memory for this visit only.
    }
    notify();
  }

  return {
    get: () => current,
    save: (item) => {
      const before = latest();
      const next = addItem(before, item);
      if (next.length === before.length) {
        current = before;
        notify();
        return false;
      }
      set(next);
      return true;
    },
    remove: (item) => set(removeItem(latest(), item)),
    refresh: () => {
      current = latest();
      notify();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let browserStore: LibraryStore | undefined;

/** One store per page, created on first use so nothing touches window during server rendering;
 *  it follows saves made in other tabs. */
export function browserLibrary(): LibraryStore {
  if (browserStore !== undefined) return browserStore;
  const store = createLibraryStore(() => window.localStorage);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (event) => {
      if (event.key === libraryKey || event.key === null) store.refresh();
    });
  }
  browserStore = store;
  return store;
}
