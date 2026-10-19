// Invented library items and an in-memory Storage for the tests.
import type { LibraryEntry, LibraryItem } from "./library-items";
import { type LibraryStore, createLibraryStore } from "./library-store";

export function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

export function demoEntry(ref: string, kind: LibraryEntry["kind"] = "profile"): LibraryEntry {
  return {
    kind,
    ref,
    title: `Demo ${ref}`,
    source_url: `https://www.example-institute.test/${ref}`,
    page_sha256: "ae1bbd3174a5e9aa574bcf0527f27df85a86375c31e72b9ca0e3d96f7e5911d4",
    span: `Demo ${ref} leads the sensor lab.`,
  };
}

export function savedItem(
  ref: string,
  kind: LibraryEntry["kind"] = "profile",
  savedAt = "2026-10-19T02:00:00.000Z",
): LibraryItem {
  return { ...demoEntry(ref, kind), saved_at: savedAt };
}

/** A store on its own in-memory storage, which every read and write reaches. */
export function memoryStore(): LibraryStore {
  const storage = memoryStorage();
  return createLibraryStore(() => storage);
}
