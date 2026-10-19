// A value kept in localStorage for now. Storage can be missing or throw (private windows, blocked
// site data), so every access is guarded and memory is the fallback; a stored value that no longer
// parses is ignored and the fallback is shown instead.

type ValueStorage = Pick<Storage, "getItem" | "setItem">;

export type LocalValue<T> = {
  get(): T;
  set(next: T): void;
  subscribe(listener: () => void): () => void;
};

type LocalValueOptions<T> = {
  storage: () => ValueStorage;
  key: string;
  parse: (value: unknown) => T | null;
  fallback: T;
};

function read<T>(raw: string | null, { parse, fallback }: LocalValueOptions<T>): T {
  if (raw === null) return fallback;
  try {
    return parse(JSON.parse(raw)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function createLocalValue<T>(options: LocalValueOptions<T>): LocalValue<T> {
  let current: T;
  try {
    current = read(options.storage().getItem(options.key), options);
  } catch {
    current = options.fallback;
  }
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      current = next;
      try {
        options.storage().setItem(options.key, JSON.stringify(next));
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
