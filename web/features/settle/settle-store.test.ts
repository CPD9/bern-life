import { describe, expect, test } from "bun:test";
import { PLOTS } from "./plots";
import { createSettleStore, settleKey } from "./settle-store";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const LAENGGASSE = PLOTS.find((plot) => plot.id === "laenggasse");
if (LAENGGASSE === undefined) throw new Error("plots changed");

describe("createSettleStore", () => {
  test("keeps the chosen plot's id on this device and reads it back", () => {
    const storage = memoryStorage();
    createSettleStore(() => storage).set(LAENGGASSE);
    expect(storage.items.get(settleKey)).toBe('{"id":"laenggasse"}');
    expect(createSettleStore(() => storage).get()).toBe(LAENGGASSE);
  });

  test("nothing stored, an unknown plot or broken JSON reads as not settled", () => {
    expect(createSettleStore(() => memoryStorage()).get()).toBeNull();
    const unknown = memoryStorage({ [settleKey]: '{"id":"bundeshaus"}' });
    expect(createSettleStore(() => unknown).get()).toBeNull();
    expect(createSettleStore(() => memoryStorage({ [settleKey]: "{" })).get()).toBeNull();
  });

  test("storage that throws keeps the choice in memory", () => {
    const blocked = () => {
      throw new Error("blocked");
    };
    const store = createSettleStore(() => ({ getItem: blocked, setItem: blocked }));
    expect(store.get()).toBeNull();
    store.set(LAENGGASSE);
    expect(store.get()).toBe(LAENGGASSE);
  });
});
