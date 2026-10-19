import { describe, expect, test } from "bun:test";
import { type FirstRunInput, firstRunCard, landingView } from "./first-run";

const newcomer: FirstRunInput = {
  account: "signed-out",
  onboarded: false,
  storyChoice: null,
  actedAlready: false,
  greetingDismissed: false,
  joinDismissed: false,
  settled: false,
  settleDismissed: false,
};

describe("firstRunCard", () => {
  test("follows the order: greeting, join after a real action, onboarding, settle, story", () => {
    expect(firstRunCard(newcomer)).toBe("greeting");
    expect(firstRunCard({ ...newcomer, actedAlready: true })).toBe("join");
    expect(firstRunCard({ ...newcomer, actedAlready: true, account: "signed-in" })).toBe(
      "onboarding",
    );
    expect(firstRunCard({ ...newcomer, account: "signed-in", onboarded: true })).toBe("settle");
    const settled = { ...newcomer, account: "signed-in", onboarded: true, settled: true } as const;
    expect(firstRunCard(settled)).toBe("story-start");
    expect(firstRunCard({ ...settled, storyChoice: "story" })).toBe("quest");
    expect(firstRunCard({ ...settled, storyChoice: "free" })).toBeNull();
  });

  test("settling is offered once after onboarding: Not now, or a story, moves on", () => {
    const onboarded = { ...newcomer, account: "signed-in", onboarded: true } as const;
    expect(firstRunCard({ ...onboarded, settleDismissed: true })).toBe("story-start");
    expect(firstRunCard({ ...onboarded, storyChoice: "free" })).toBe("settle");
    expect(firstRunCard({ ...onboarded, storyChoice: "free", settleDismissed: true })).toBeNull();
    expect(firstRunCard({ ...onboarded, storyChoice: "story" })).toBe("quest");
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

test("a player who finished onboarding lands in the office, a newcomer on the map", () => {
  expect(landingView(true)).toBe("home");
  expect(landingView(false)).toBe("map");
});
