import { describe, expect, test } from "bun:test";
import { copyOf, resultFixture } from "@/test/fixtures";
import { entryFromEvidence, entryFromResult, parseItems, savedEventNames } from "./library-items";
import { createLibraryStore, libraryKey } from "./library-store";
import { memoryStorage, memoryStore, savedItem } from "./testing";

const older = savedItem("demo-b", "profile", "2026-10-19T01:00:00.000Z");
const newer = savedItem("demo-a", "page", "2026-10-19T03:00:00.000Z");
const sameTimeA = savedItem("demo-c", "opportunity");
const sameTimeB = savedItem("demo-d", "opportunity");

describe("createLibraryStore", () => {
  test("saved items are written and read back newest first, then by ref", () => {
    const storage = memoryStorage();
    const store = createLibraryStore(() => storage);
    for (const item of [older, sameTimeB, newer, sameTimeA]) expect(store.save(item)).toBe(true);
    const expected = [newer, sameTimeA, sameTimeB, older];
    expect(storage.getItem(libraryKey)).toBe(JSON.stringify(expected));
    expect(createLibraryStore(() => storage).get()).toEqual(expected);
  });

  test("saving the same kind and ref again keeps the first save", () => {
    const store = memoryStore();
    expect(store.save(older)).toBe(true);
    expect(store.save({ ...older, saved_at: "2026-10-19T04:00:00.000Z" })).toBe(false);
    expect(store.get()).toEqual([older]);
  });

  test("remove drops only that item and tells listeners", () => {
    const store = memoryStore();
    store.save(older);
    store.save(newer);
    let heard = 0;
    store.subscribe(() => (heard += 1));
    store.remove(older);
    expect(store.get()).toEqual([newer]);
    expect(heard).toBe(1);
  });

  test("corrupt storage starts empty, and blocked storage keeps saves in memory", () => {
    expect(createLibraryStore(() => memoryStorage({ [libraryKey]: '[{"kind":' })).get()).toEqual(
      [],
    );
    const blocked = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createLibraryStore(() => blocked);
    expect(store.save(older)).toBe(true);
    expect(store.get()).toEqual([older]);
  });
});

describe("two tabs on one storage", () => {
  test("each change starts from storage, so neither tab overwrites the other", () => {
    const storage = memoryStorage();
    const first = createLibraryStore(() => storage);
    const second = createLibraryStore(() => storage);
    first.save(older);
    second.save(newer);
    expect(createLibraryStore(() => storage).get()).toEqual([newer, older]);
    expect(first.save(newer)).toBe(false);
    first.remove(older);
    expect(createLibraryStore(() => storage).get()).toEqual([newer]);
    expect(second.get()).toEqual([newer, older]);
    second.refresh();
    expect(second.get()).toEqual([newer]);
  });
});

describe("parseItems", () => {
  test("drops what does not parse and duplicates, keeping the first copy", () => {
    const raw = JSON.parse(JSON.stringify([older, newer])) as Record<string, unknown>[];
    const stored = [
      ...raw,
      { ...raw[0], saved_at: "2026-10-19T05:00:00.000Z" },
      { ...raw[0], ref: "demo-x", kind: "robot" },
      { ...raw[0], ref: "demo-y", saved_at: "yesterday" },
      { ...raw[0], ref: "demo-z", span: 7 },
      "item",
      null,
    ];
    expect(parseItems(stored)).toEqual([newer, older]);
    expect(parseItems({ items: [] })).toEqual([]);
  });
});

describe("entries", () => {
  test("a result keeps its name, page and the sentence that names it, nothing else", () => {
    const person = resultFixture.results[0];
    if (person === undefined) throw new Error("fixture has no result");
    expect(entryFromResult(person)).toEqual({
      kind: "profile",
      ref: "person-example-ada-muster",
      title: "Ada Muster",
      source_url: "https://www.example-institute.test/team/ada-muster",
      page_sha256: "ae1bbd3174a5e9aa574bcf0527f27df85a86375c31e72b9ca0e3d96f7e5911d4",
      span: "Dr. Ada Muster",
    });
    const call = copyOf(person);
    call.profile.kind = "call";
    expect(entryFromResult(call).kind).toBe("opportunity");
    expect(entryFromEvidence(person.profile.name.evidence)).toEqual({
      kind: "page",
      ref: "https://www.example-institute.test/team/ada-muster",
      title: "www.example-institute.test/team/ada-muster",
      source_url: "https://www.example-institute.test/team/ada-muster",
      page_sha256: "ae1bbd3174a5e9aa574bcf0527f27df85a86375c31e72b9ca0e3d96f7e5911d4",
      span: "Dr. Ada Muster",
    });
  });

  test("every save is a library save; an opportunity is also an opportunity save", () => {
    expect(savedEventNames(older)).toEqual(["library_item_saved"]);
    expect(savedEventNames(sameTimeA)).toEqual(["library_item_saved", "opportunity_saved"]);
  });
});
