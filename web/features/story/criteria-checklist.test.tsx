import { describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import { emittedToday } from "@/infrastructure/app-events";
import { storyFixture } from "@/test/story";
import { noQuestYet, criterionRows } from "./criteria";
import { CriteriaChecklist } from "./criteria-checklist";
import { type StoryState, emptyStoryState, storyProgress } from "./engine";
import type { StoryController } from "./use-story";

function controllerAt(done: string[]): StoryController {
  const state: StoryState = { ...emptyStoryState, choice: "story", done };
  const noop = () => undefined;
  return {
    story: storyFixture,
    state,
    progress: storyProgress(storyFixture, state, emittedToday),
    start: noop,
    explore: noop,
    focus: noop,
    restart: noop,
  };
}

describe("criterionRows", () => {
  test("an unmet criterion says why it waits; a playable or met one says nothing", () => {
    const rows = criterionRows(controllerAt(["honest/invented"]).progress);
    expect(rows.map(({ criterion, met, note }) => [criterion, met, note])).toEqual([
      ["c1-right-people", false, null],
      ["c2-wording", false, null],
      ["c3-traceable", false, null],
      ["c4-structured", false, null],
      ["c5-sources", false, noQuestYet],
      [
        "c6-extend",
        false,
        "The sources admin and the numbers screen are not in the game yet; a new site is one file in sources/.",
      ],
      ["ethics-abstain", true, null],
    ]);
  });
});

describe("CriteriaChecklist", () => {
  test("below sm it is a short count that opens the list", () => {
    render(<CriteriaChecklist controller={controllerAt(["honest/invented"])} />);
    const toggle = screen.getByRole("button", { name: "Case: 1 of 7 met" });
    expect(toggle.className).toContain("sm:hidden");
    const list = document.getElementById(toggle.getAttribute("aria-controls")!)!;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(list.className.split(" ")).toContain("hidden");
    expect(list.className.split(" ")).toContain("sm:flex");

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(list.className.split(" ")).not.toContain("hidden");
    expect(list.className.split(" ")).toContain("flex");
  });

  test("from sm up the heading carries the same count", () => {
    render(<CriteriaChecklist controller={controllerAt([])} />);
    expect(
      screen.getByRole("heading", { name: "The case, met in the game · 0 of 7 met" }),
    ).toBeTruthy();
  });
});
