// The first-run journey as a pure reducer, so order, Back, Skip and resuming can be checked
// without rendering anything. `done` means the player has finished once; coming back to /start
// reopens the journey at the first step with their answers kept.

import { type Profile, emptyProfile, parseProfile } from "./profile";

export const onboardingSteps = ["role", "look", "goal", "visibility", "agent"] as const;

export type StepId = (typeof onboardingSteps)[number];

export const stepTitles: Readonly<Record<StepId, string>> = {
  role: "Who are you in Bern?",
  look: "Your look",
  goal: "What brings you here?",
  visibility: "Who sees what",
  agent: "Create your agent",
};

export type OnboardingState = {
  readonly step: number;
  readonly profile: Profile;
  readonly done: boolean;
};

export type OnboardingAction =
  | { readonly type: "next" }
  | { readonly type: "back" }
  | { readonly type: "skip" }
  | { readonly type: "reopen" }
  | { readonly type: "answer"; readonly change: Partial<Profile> };

export const initialOnboarding: OnboardingState = { step: 0, profile: emptyProfile, done: false };

const lastStep = onboardingSteps.length - 1;

/** Whether this action ends the journey from the given state. */
export function finishes(state: OnboardingState, action: OnboardingAction): boolean {
  return action.type === "skip" || (action.type === "next" && state.step === lastStep);
}

export function stepAt(state: OnboardingState): StepId {
  return onboardingSteps[state.step] ?? "role";
}

export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case "next":
      return state.step === lastStep
        ? { ...state, done: true }
        : { ...state, step: state.step + 1 };
    case "back":
      return { ...state, step: Math.max(0, state.step - 1) };
    case "skip":
      return { ...state, done: true };
    case "reopen":
      return { ...state, step: 0 };
    case "answer":
      return { ...state, profile: { ...state.profile, ...action.change } };
  }
}

/** A saved journey picks up where it was left; anything unreadable starts over. */
export function parseOnboarding(value: unknown): OnboardingState {
  if (typeof value !== "object" || value === null) return initialOnboarding;
  const { step, profile, done } = value as Record<string, unknown>;
  const validStep = typeof step === "number" && Number.isInteger(step) && step >= 0;
  return {
    step: validStep ? Math.min(step, lastStep) : 0,
    profile: parseProfile(profile),
    done: done === true,
  };
}
