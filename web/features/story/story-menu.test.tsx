import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { emittedToday } from "@/infrastructure/app-events";
import { storyFixture } from "@/test/story";
import { emptyStoryState, storyProgress } from "./engine";
import { StoryMenu } from "./story-menu";
import type { StoryController } from "./use-story";

const state = { ...emptyStoryState, choice: "story" as const };
const noop = () => undefined;
const controller: StoryController = {
  story: storyFixture,
  state,
  progress: storyProgress(storyFixture, state, emittedToday),
  start: noop,
  explore: noop,
  focus: noop,
  restart: noop,
};

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        All quests
      </button>
      <StoryMenu controller={controller} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function openMenu() {
  const opener = screen.getByRole("button", { name: "All quests" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

describe("StoryMenu", () => {
  test("each coming-next row shows its one-line reason, and optional quests say so", () => {
    render(<Harness />);
    openMenu();
    const row = (title: string) => screen.getByRole("heading", { name: title }).closest("li")!;
    const visit = Array.from(row("Visit an institute").querySelectorAll("p, span"));
    expect(visit.map((element) => element.textContent).slice(0, 3)).toEqual([
      "Coming next · optional",
      "Walk to a place and see who works there.",
      "Opening a place on the map does not report to the story yet.",
    ]);
    // Sending a message counts toward Grow in Bern, so it is open, not coming next.
    expect(row("Grow in Bern").textContent).toContain("Open · optional");
    expect(row("Find the right people").querySelectorAll("p")).toHaveLength(1);
  });

  test("Close gives focus back to what opened the menu", async () => {
    render(<Harness />);
    const opener = openMenu();
    expect(document.querySelector("dialog")!.open).toBe(true);
    screen.getByRole("button", { name: "Close" }).focus();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
    });
    expect(document.querySelector("dialog")!.open).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  test("Escape (the dialog's close event) also gives focus back", async () => {
    render(<Harness />);
    const opener = openMenu();
    screen.getByRole("button", { name: "Close" }).focus();
    await act(async () => {
      document.querySelector("dialog")!.dispatchEvent(new Event("close"));
    });
    expect(document.activeElement).toBe(opener);
  });
});
