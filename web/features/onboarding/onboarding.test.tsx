import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { Onboarding } from "./onboarding";
import { type OnboardingStore, createOnboardingStore } from "./onboarding-store";
import { useOnboarding } from "./use-onboarding";

function memoryStore(): OnboardingStore {
  const items = new Map<string, string>();
  return createOnboardingStore(() => ({
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  }));
}

function Harness({ source, onDone }: { source: () => OnboardingStore; onDone: () => void }) {
  const [state, dispatch] = useOnboarding(source);
  return (
    <Onboarding
      state={state}
      dispatch={dispatch}
      lookStep={<p>Avatar editor slot</p>}
      onDone={onDone}
    />
  );
}

function setup() {
  const store = memoryStore();
  const source = () => store;
  const done: string[] = [];
  render(<Harness source={source} onDone={() => done.push("done")} />);
  return { store, done };
}

const proceed = () => fireEvent.click(screen.getByRole("button", { name: "Continue" }));

describe("Onboarding", () => {
  test("the role answer is saved and Continue shows the Look slot as step 2 of 4", () => {
    const { store } = setup();
    fireEvent.click(screen.getByLabelText(/Researcher/));
    proceed();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading.textContent).toBe("Your look");
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("Avatar editor slot")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Step 2 of 4" })).toBeTruthy();
    expect(store.get()).toMatchObject({ step: 1, profile: { role: "researcher" } });
  });

  test("Continue on the last step saves the journey as done and leaves once", () => {
    const { store, done } = setup();
    proceed();
    proceed();
    fireEvent.click(screen.getByLabelText(/Find funding or a call/));
    proceed();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Who sees what");
    expect(screen.getByText("Uploads are private unless you choose to share one.")).toBeTruthy();
    expect(done).toEqual([]);
    proceed();
    expect(store.get()).toMatchObject({ done: true, profile: { goal: "funding" } });
    expect(done).toEqual(["done"]);
  });

  test("Skip finishes with private visibility and leaves once", () => {
    const { store, done } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(store.get()).toMatchObject({ done: true, profile: { visibility: "private" } });
    expect(done).toEqual(["done"]);
  });

  test("Back is hidden on the first step", () => {
    setup();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    proceed();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
  });
});
