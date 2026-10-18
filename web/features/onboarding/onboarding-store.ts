// The journey and its answers live in localStorage for now, one key, so a visit can resume on the
// step it left. Storage can be missing or throw (private windows, blocked site data), so every
// access is guarded and memory is the fallback.

import { type OnboardingState, initialOnboarding, parseOnboarding } from "./steps";

export const onboardingKey = "bernlife.onboarding";

type OnboardingStorage = Pick<Storage, "getItem" | "setItem">;

export type OnboardingStore = {
  get(): OnboardingState;
  set(next: OnboardingState): void;
  subscribe(listener: () => void): () => void;
};

function readOnboarding(raw: string | null): OnboardingState {
  if (raw === null) return initialOnboarding;
  try {
    return parseOnboarding(JSON.parse(raw));
  } catch {
    return initialOnboarding;
  }
}

export function createOnboardingStore(storage: () => OnboardingStorage): OnboardingStore {
  let current: OnboardingState;
  try {
    current = readOnboarding(storage().getItem(onboardingKey));
  } catch {
    current = initialOnboarding;
  }
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (next) => {
      current = next;
      try {
        storage().setItem(onboardingKey, JSON.stringify(next));
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
