import { describe, expect, test } from "bun:test";
import { createOnboardingStore, onboardingKey } from "./onboarding-store";
import { emptyProfile } from "./profile";
import { initialOnboarding } from "./steps";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const halfway = {
  step: 3,
  profile: { ...emptyProfile, role: "researcher", goal: "collaborator" },
  done: false,
} as const;

describe("createOnboardingStore", () => {
  test("the journey is saved and read back on the next visit", () => {
    const storage = memoryStorage();
    createOnboardingStore(() => storage).set(halfway);
    expect(storage.getItem(onboardingKey)).toBe(JSON.stringify(halfway));
    expect(createOnboardingStore(() => storage).get()).toEqual(halfway);
  });

  test("a corrupted value is ignored and the journey starts at step one", () => {
    const storage = memoryStorage({ [onboardingKey]: '{"step":' });
    expect(createOnboardingStore(() => storage).get()).toEqual(initialOnboarding);
  });

  test("blocked storage keeps the journey in memory for this visit", () => {
    const blocked = {
      getItem: (): string | null => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createOnboardingStore(() => blocked);
    expect(store.get()).toEqual(initialOnboarding);
    store.set(halfway);
    expect(store.get()).toEqual(halfway);
  });
});
