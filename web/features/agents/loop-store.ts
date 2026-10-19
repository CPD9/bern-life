// Loops live in localStorage for now, one key, so they survive a reload on the same device.
// Storage can be missing or throw (private windows, blocked site data), so every access is guarded
// and memory is the fallback. A stored loop that no longer parses is dropped, not repaired.

import { isKind } from "./kinds";
import type { Change, Loop, LoopEntry, LoopRun } from "./loops";

export const loopsKey = "bernlife.agents.loops";

type LoopStorage = Pick<Storage, "getItem" | "setItem">;

export type LoopStore = {
  get(): readonly Loop[];
  set(next: readonly Loop[]): void;
  subscribe(listener: () => void): () => void;
};

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEntry(value: unknown): LoopEntry | null {
  if (!isFields(value)) return null;
  const { id, name, kind, href } = value;
  if (typeof id !== "string" || typeof name !== "string" || typeof href !== "string") return null;
  return isKind(kind) ? { id, name, kind, href } : null;
}

function parseList<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map(parse);
  return items.every((item): item is T => item !== null) ? items : null;
}

function parseRun(value: unknown): LoopRun | null {
  if (!isFields(value)) return null;
  const entries = parseList(value.entries, parseEntry);
  const { snapshot, mock } = value;
  if (typeof snapshot !== "string" || typeof mock !== "boolean" || entries === null) return null;
  return { snapshot, mock, entries };
}

function parseChange(value: unknown): Change | null {
  if (!isFields(value) || (value.type !== "new" && value.type !== "dropped")) return null;
  const entry = parseEntry(value.entry);
  return entry === null ? null : { type: value.type, entry };
}

function parseLoop(value: unknown): Loop | null {
  if (!isFields(value)) return null;
  const { id, query } = value;
  const kinds = parseList(value.kinds, (kind) => (isKind(kind) ? kind : null));
  const changes = value.changes === null ? null : parseList(value.changes, parseChange);
  const last = value.last === null ? null : parseRun(value.last);
  if (typeof id !== "string" || typeof query !== "string" || kinds === null) return null;
  if (value.changes !== null && changes === null) return null;
  if (value.last !== null && last === null) return null;
  return { id, query, kinds, last, changes };
}

export function parseLoops(value: unknown): Loop[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseLoop).filter((loop) => loop !== null);
}

function readLoops(raw: string | null): readonly Loop[] {
  if (raw === null) return [];
  try {
    return parseLoops(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function createLoopStore(storage: () => LoopStorage): LoopStore {
  let current: readonly Loop[];
  try {
    current = readLoops(storage().getItem(loopsKey));
  } catch {
    current = [];
  }
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      current = next;
      try {
        storage().setItem(loopsKey, JSON.stringify(next));
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

let browserStore: LoopStore | undefined;

/** One store per page, created on first use so nothing touches window during server rendering. */
export function browserLoops(): LoopStore {
  browserStore ??= createLoopStore(() => window.localStorage);
  return browserStore;
}
