import { describe, expect, test } from "bun:test";
import { type FirstRunInput, firstRunCard } from "./first-run";

const newcomer: FirstRunInput = {
  account: "signed-out",
  onboarded: false,
  storyChoice: null,
  actedAlready: false,
  greetingDismissed: false,
  joinDismissed: false,
};

describe("firstRunCard", () => {
  test("follows the order: greeting, join after a real action, onboarding, story", () => {
    expect(firstRunCard(newcomer)).toBe("greeting");
    expect(firstRunCard({ ...newcomer, actedAlready: true })).toBe("join");
    expect(firstRunCard({ ...newcomer, actedAlready: true, account: "signed-in" })).toBe(
      "onboarding",
    );
    expect(firstRunCard({ ...newcomer, account: "signed-in", onboarded: true })).toBe(
      "story-start",
    );
    expect(firstRunCard({ ...newcomer, onboarded: true, storyChoice: "story" })).toBe("quest");
    expect(firstRunCard({ ...newcomer, onboarded: true, storyChoice: "free" })).toBeNull();
  });

  test("Not now hides the join card, and a dismissed greeting stays away", () => {
    expect(firstRunCard({ ...newcomer, actedAlready: true, joinDismissed: true })).toBe("greeting");
    expect(
      firstRunCard({
        ...newcomer,
        actedAlready: true,
        joinDismissed: true,
        greetingDismissed: true,
      }),
    ).toBeNull();
  });

  test("while the account is still being checked, nobody is asked to join", () => {
    expect(firstRunCard({ ...newcomer, account: "checking", actedAlready: true })).toBe("greeting");
  });

  test("progress from before joining still shows: a story already chosen keeps its quest panel", () => {
    expect(firstRunCard({ ...newcomer, account: "signed-in", storyChoice: "story" })).toBe("quest");
  });
});
