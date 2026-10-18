"use client";

import { useCallback, useSyncExternalStore } from "react";
import { type OnboardingStore, createOnboardingStore } from "./onboarding-store";
import {
  type OnboardingAction,
  type OnboardingState,
  initialOnboarding,
  onboardingReducer,
} from "./steps";

let store: OnboardingStore | undefined;

export function browserOnboardingStore(): OnboardingStore {
  store ??= createOnboardingStore(() => window.localStorage);
  return store;
}

export function useOnboarding(
  source: () => OnboardingStore = browserOnboardingStore,
): [OnboardingState, (action: OnboardingAction) => void] {
  const state = useSyncExternalStore(
    (listener) => source().subscribe(listener),
    () => source().get(),
    () => initialOnboarding,
  );
  const dispatch = useCallback(
    (action: OnboardingAction) => source().set(onboardingReducer(source().get(), action)),
    [source],
  );
  return [state, dispatch];
}
