import { describe, expect, test } from "bun:test";
import { defaultBear } from "./bear-config";
import { avatarKey, createAvatarStore } from "./avatar-store";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

const chosen = {
  kind: "red-panda",
  fur: "ginger",
  face: "wink",
  outfit: "field-work",
  accessory: "backpack",
} as const;

describe("createAvatarStore", () => {
  test("a saved avatar is read back by the next visit", () => {
    const storage = memoryStorage();
    createAvatarStore(() => storage).set(chosen);
    expect(storage.getItem(avatarKey)).toBe(JSON.stringify(chosen));
    expect(createAvatarStore(() => storage).get()).toEqual(chosen);
  });

  test("a corrupted or unknown value is ignored and the default bear shown", () => {
    const corrupted = memoryStorage({ [avatarKey]: "{not json" });
    expect(createAvatarStore(() => corrupted).get()).toEqual(defaultBear);

    const unknown = memoryStorage({ [avatarKey]: JSON.stringify({ kind: "dragon" }) });
    expect(createAvatarStore(() => unknown).get()).toEqual(defaultBear);
  });

  test("a saved human figure from before the bears comes back as a matching bear", () => {
    const human = {
      body: "slim",
      skin: "tone-9",
      hair: "curly",
      outfit: "lab-coat",
      accent: "teal",
    };
    const storage = memoryStorage({ [avatarKey]: JSON.stringify(human) });
    expect(createAvatarStore(() => storage).get()).toEqual({
      kind: "brown-bear",
      fur: "cocoa",
      face: "happy",
      outfit: "lab-coat",
      accessory: "none",
    });
  });

  test("blocked storage keeps the avatar in memory and still notifies", () => {
    const store = createAvatarStore(() => throwing);
    let notified = 0;
    store.subscribe(() => notified++);
    expect(store.get()).toEqual(defaultBear);
    store.set(chosen);
    expect(store.get()).toEqual(chosen);
    expect(notified).toBe(1);
  });
});
