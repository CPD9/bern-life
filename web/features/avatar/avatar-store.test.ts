import { describe, expect, test } from "bun:test";
import { defaultAvatar } from "./avatar-config";
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
  body: "slim",
  skin: "tone-7",
  hair: "curly",
  outfit: "field-work",
  accent: "teal",
} as const;

describe("createAvatarStore", () => {
  test("a saved avatar is read back by the next visit", () => {
    const storage = memoryStorage();
    createAvatarStore(() => storage).set(chosen);
    expect(storage.getItem(avatarKey)).toBe(JSON.stringify(chosen));
    expect(createAvatarStore(() => storage).get()).toEqual(chosen);
  });

  test("a corrupted or outdated value is ignored and the default avatar shown", () => {
    const corrupted = memoryStorage({ [avatarKey]: "{not json" });
    expect(createAvatarStore(() => corrupted).get()).toEqual(defaultAvatar);

    const outdated = memoryStorage({ [avatarKey]: JSON.stringify({ ...chosen, hair: "mohawk" }) });
    expect(createAvatarStore(() => outdated).get()).toEqual(defaultAvatar);
  });

  test("blocked storage keeps the avatar in memory and still notifies", () => {
    const store = createAvatarStore(() => throwing);
    let notified = 0;
    store.subscribe(() => notified++);
    expect(store.get()).toEqual(defaultAvatar);
    store.set(chosen);
    expect(store.get()).toEqual(chosen);
    expect(notified).toBe(1);
  });
});
