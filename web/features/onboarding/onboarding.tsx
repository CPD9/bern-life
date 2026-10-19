"use client";

// The first-run frame: a dash per step for progress, Back, Skip and one green Continue. The Look
// and agent steps are slots because their editors are another feature, and so is the greeting
// above the first step; app/ passes them in.

import { type ReactNode, useEffect, useRef } from "react";
import { ChoiceCards } from "./choice-cards";
import { type Profile, goalOptions, roleOptions } from "./profile";
import {
  type OnboardingAction,
  type OnboardingState,
  finishes,
  onboardingSteps,
  stepAt,
  stepTitles,
} from "./steps";
import { VisibilityStep } from "./visibility-step";

type OnboardingProps = {
  state: OnboardingState;
  dispatch: (action: OnboardingAction) => void;
  lookStep: ReactNode;
  agentStep: ReactNode;
  greeting: ReactNode;
  onDone: () => void;
};

function ProgressDashes({ step }: { step: number }) {
  return (
    <ol
      aria-label={`Step ${step + 1} of ${onboardingSteps.length}`}
      className="flex flex-1 gap-1.5"
    >
      {onboardingSteps.map((id, index) => (
        <li
          key={id}
          aria-current={index === step ? "step" : undefined}
          className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-chip"}`}
        />
      ))}
    </ol>
  );
}

export function Onboarding({
  state,
  dispatch,
  lookStep,
  agentStep,
  greeting,
  onDone,
}: OnboardingProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = stepAt(state);
  const answer = (change: Partial<Profile>) => dispatch({ type: "answer", change });
  // Leaving is tied to the button that ends the journey, not to the stored flag, so a player who
  // finished before can come back and walk through again.
  const act = (action: OnboardingAction) => {
    dispatch(action);
    if (finishes(state, action)) onDone();
  };

  // Each step is a new screen; moving focus to its title tells keyboard and screen reader users.
  const shownStep = useRef(state.step);
  useEffect(() => {
    if (shownStep.current === state.step) return;
    shownStep.current = state.step;
    headingRef.current?.focus();
  }, [state.step]);

  const body: Record<typeof step, ReactNode> = {
    role: (
      <ChoiceCards
        legend={stepTitles.role}
        choices={roleOptions}
        value={state.profile.role}
        onChange={(role) => answer({ role })}
      />
    ),
    look: lookStep,
    goal: (
      <ChoiceCards
        legend={stepTitles.goal}
        choices={goalOptions}
        value={state.profile.goal}
        onChange={(goal) => answer({ goal })}
      />
    ),
    visibility: (
      <VisibilityStep
        value={state.profile.visibility}
        onChange={(visibility) => answer({ visibility })}
      />
    ),
    agent: agentStep,
  };

  return (
    <div className="from-sky-top to-sky-bottom flex min-h-dvh justify-center bg-linear-to-b px-4 py-6 sm:py-12">
      <main className="bg-panel shadow-panel border-panel-border rounded-panel flex w-full max-w-3xl flex-col gap-6 self-start border p-5 sm:p-8">
        <header className="flex items-center gap-4">
          <ProgressDashes step={state.step} />
          <button
            type="button"
            onClick={() => act({ type: "skip" })}
            className="text-muted rounded-pill px-3 py-1 text-sm font-bold hover:underline"
          >
            Skip
          </button>
        </header>
        {state.step === 0 && greeting}
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold tracking-tight">
          {stepTitles[step]}
        </h1>
        {body[step]}
        <footer className="flex items-center justify-between gap-3 pt-2">
          {state.step > 0 ? (
            <button
              type="button"
              onClick={() => act({ type: "back" })}
              className="bg-chip rounded-pill px-5 py-2.5 font-bold"
            >
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => act({ type: "next" })}
            className="bg-primary text-primary-ink rounded-pill px-7 py-2.5 font-extrabold"
          >
            Continue
          </button>
        </footer>
      </main>
    </div>
  );
}
