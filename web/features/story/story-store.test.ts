import { describe, expect, test } from "bun:test";
import { emptyStoryState } from "./engine";
import { createStoryStore, parseStoryState } from "./story-store";

describe("parseStoryState", () => {
  test("keeps valid fields and drops broken ones", () => {
    expect(parseStoryState('{"choice":"story","done":["a/b",3],"focus":"honest"}')).toEqual({
      choice: "story",
      done: ["a/b"],
      focus: "honest",
    });
    expect(parseStoryState("{not json")).toEqual(emptyStoryState);
    expect(parseStoryState('{"choice":"maybe"}')).toEqual(emptyStoryState);
  });
});

describe("createStoryStore", () => {
  test("resumes from storage and saves each change", () => {
    const saved = new Map([["k", '{"choice":"story","done":["find-experts/ask"]}']]);
    const store = createStoryStore(
      () => ({
        getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => void saved.set(key, value),
      }),
      "k",
    );
    expect(store.get().done).toEqual(["find-experts/ask"]);
    store.set({ ...store.get(), focus: "brief" });
    expect(saved.get("k")).toBe('{"choice":"story","done":["find-experts/ask"],"focus":"brief"}');
  });

  test("blocked storage starts empty and keeps changes in memory", () => {
    const store = createStoryStore(() => {
      throw new DOMException("denied", "SecurityError");
    }, "k");
    expect(store.get()).toEqual(emptyStoryState);
    store.set({ ...emptyStoryState, choice: "free" });
    expect(store.get().choice).toBe("free");
  });
});
