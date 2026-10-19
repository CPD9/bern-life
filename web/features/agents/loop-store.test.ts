import { describe, expect, test } from "bun:test";
import { createLoopStore, loopsKey, parseLoops } from "./loop-store";
import { type Loop, makeLoop, recordRun } from "./loops";
import { memoryStorage, responseWith } from "./testing";

function ran(): Loop {
  const loop = makeLoop("insulin pumps", ["unit"]);
  if (loop === null) throw new Error("invalid loop");
  const first = recordRun(loop, responseWith("s1", [["a", "unit"]]));
  return recordRun(first, responseWith("s2", [["b", "unit"]]));
}

describe("createLoopStore", () => {
  test("loops are saved and read back on the next visit", () => {
    const storage = memoryStorage();
    createLoopStore(() => storage).set([ran()]);
    expect(storage.getItem(loopsKey)).toBe(JSON.stringify([ran()]));
    expect(createLoopStore(() => storage).get()).toEqual([ran()]);
  });

  test("a corrupted value is ignored and the list starts empty", () => {
    const storage = memoryStorage({ [loopsKey]: '[{"id":' });
    expect(createLoopStore(() => storage).get()).toEqual([]);
  });

  test("blocked storage keeps the loops in memory for this visit", () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createLoopStore(() => blocked);
    expect(store.get()).toEqual([]);
    store.set([ran()]);
    expect(store.get()).toEqual([ran()]);
  });

  test("listeners hear every change until they unsubscribe", () => {
    const store = createLoopStore(() => memoryStorage());
    let heard = 0;
    const stop = store.subscribe(() => (heard += 1));
    store.set([ran()]);
    stop();
    store.set([]);
    expect(heard).toBe(1);
  });
});

describe("parseLoops", () => {
  test("a loop that no longer parses is dropped and the others are kept", () => {
    const good = JSON.parse(JSON.stringify(ran())) as Record<string, unknown>;
    const badKind = { ...good, id: "x", kinds: ["robot"] };
    const badRun = { ...good, id: "y", last: { snapshot: 1, mock: false, entries: [] } };
    const badChange = { ...good, id: "z", changes: [{ type: "moved", entry: {} }] };
    expect(parseLoops([good, badKind, badRun, badChange, "loop"])).toEqual([ran()]);
  });

  test("a loop that never ran keeps its empty run and changes", () => {
    const fresh = makeLoop("insulin", []);
    expect(fresh).not.toBeNull();
    expect(parseLoops(JSON.parse(JSON.stringify([fresh])))).toEqual([fresh as Loop]);
  });

  test("anything but a list is no loops", () => {
    expect(parseLoops({ loops: [] })).toEqual([]);
  });
});
