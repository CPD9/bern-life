import { describe, expect, test } from "bun:test";
import { emptyProfile } from "./profile";
import {
  type OnboardingState,
  finishes,
  initialOnboarding,
  onboardingReducer,
  onboardingSteps,
  parseOnboarding,
  stepAt,
} from "./steps";

type Move = "next" | "back" | "skip" | "reopen";

function run(state: OnboardingState, ...types: Move[]): OnboardingState {
  return types.reduce((current, type) => onboardingReducer(current, { type }), state);
}

describe("onboardingReducer", () => {
  test("Continue walks role, look, goal, visibility, then finishes", () => {
    expect(onboardingSteps).toEqual(["role", "look", "goal", "visibility"]);
    const seen: string[] = [];
    let state = initialOnboarding;
    while (!state.done) {
      seen.push(stepAt(state));
      state = run(state, "next");
    }
    expect(seen).toEqual(["role", "look", "goal", "visibility"]);
    expect(state.step).toBe(3);
  });

  test("Back on the first step stays put; Back after two steps returns one", () => {
    expect(run(initialOnboarding, "back")).toEqual(initialOnboarding);
    expect(stepAt(run(initialOnboarding, "next", "next", "back"))).toBe("look");
  });

  test("Skip finishes at once with the private defaults", () => {
    expect(run(initialOnboarding, "next", "skip")).toEqual({
      step: 1,
      profile: emptyProfile,
      done: true,
    });
  });

  test("reopening goes back to the first step and keeps the answers and done", () => {
    const finished = {
      step: 3,
      profile: { ...emptyProfile, role: "student", goal: "hiring" },
      done: true,
    } as const;
    expect(run(finished, "reopen")).toEqual({ ...finished, step: 0 });
  });

  test("an answer changes only its own field", () => {
    const state = onboardingReducer(initialOnboarding, {
      type: "answer",
      change: { goal: "funding" },
    });
    expect(state.profile).toEqual({ ...emptyProfile, goal: "funding" });
  });
});

describe("finishes", () => {
  test("only Skip, or Continue on the last step, ends the journey", () => {
    const last = { ...initialOnboarding, step: 3 };
    expect(finishes(initialOnboarding, { type: "skip" })).toBe(true);
    expect(finishes(last, { type: "next" })).toBe(true);
    expect(finishes(initialOnboarding, { type: "next" })).toBe(false);
    expect(finishes(last, { type: "back" })).toBe(false);
  });
});

describe("parseOnboarding", () => {
  test("a saved journey resumes on its step with its answers", () => {
    const saved = { step: 2, profile: { ...emptyProfile, role: "student" }, done: false } as const;
    expect(parseOnboarding(saved)).toEqual(saved);
  });

  test("a step out of range is clamped, a broken one starts over", () => {
    expect(parseOnboarding({ step: 9, profile: {}, done: false }).step).toBe(3);
    expect(parseOnboarding({ step: -1 }).step).toBe(0);
    expect(parseOnboarding({ step: "2" }).step).toBe(0);
    expect(parseOnboarding("resume")).toEqual(initialOnboarding);
  });
});
