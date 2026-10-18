// Story progress lives in the browser for now (accounts later). Storage can be missing or throw,
// so every access is guarded and memory is the fallback; a broken record starts the story afresh.
import { type StoryState, emptyStoryState } from "./engine";

type StoryStorage = Pick<Storage, "getItem" | "setItem">;

export type StoryStore = {
  get(): StoryState;
  set(next: StoryState): void;
  subscribe(listener: () => void): () => void;
};

export function parseStoryState(raw: string | null): StoryState {
  try {
    const value: unknown = raw === null ? null : JSON.parse(raw);
    const { choice, done, focus } = (
      typeof value === "object" && value !== null ? value : {}
    ) as Record<string, unknown>;
    return {
      choice: choice === "story" || choice === "free" ? choice : null,
      done: Array.isArray(done) ? done.filter((key): key is string => typeof key === "string") : [],
      focus: typeof focus === "string" ? focus : null,
    };
  } catch {
    return emptyStoryState;
  }
}

export function createStoryStore(storage: () => StoryStorage, key: string): StoryStore {
  let current: StoryState | undefined;
  const listeners = new Set<() => void>();
  function load(): StoryState {
    if (current) return current;
    try {
      current = parseStoryState(storage().getItem(key));
    } catch {
      current = emptyStoryState;
    }
    return current;
  }
  return {
    get: load,
    set: (next) => {
      current = next;
      try {
        storage().setItem(key, JSON.stringify(next));
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
