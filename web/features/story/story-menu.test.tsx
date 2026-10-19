import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { type AppEventName, emittedToday } from "@/infrastructure/app-events";
import { storyFixture } from "@/test/story";
import { emptyStoryState, storyProgress } from "./engine";
import { StoryMenu } from "./story-menu";
import type { StoryController } from "./use-story";

const state = { ...emptyStoryState, choice: "story" as const };
const noop = () => undefined;
function controllerWith(emitted: readonly AppEventName[]): StoryController {
  return {
    story: storyFixture,
    state,
    progress: storyProgress(storyFixture, state, emitted),
    start: noop,
    explore: noop,
    focus: noop,
    restart: noop,
  };
}

function Harness({ controller = controllerWith(emittedToday) }: { controller?: StoryController }) {
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
    const withoutNumbers = emittedToday.filter((event) => event !== "numbers_seen");
    render(<Harness controller={controllerWith(withoutNumbers)} />);
    openMenu();
    const row = (title: string) => screen.getByRole("heading", { name: title }).closest("li")!;
    const extend = Array.from(row("Add a new source").querySelectorAll("p, span"));
    expect(extend.map((element) => element.textContent).slice(0, 3)).toEqual([
      "Coming next · optional",
      "Add an institution's website with one configuration file.",
      "Adding a source does not report to the story yet; a new site is one file in sources/.",
    ]);
  });

  test("today every quest is open: none waits on an event nothing emits", () => {
    render(<Harness />);
    openMenu();
    const row = (title: string) => screen.getByRole("heading", { name: title }).closest("li")!;
    for (const title of ["Arrive and settle", "Visit an institute", "Add a new source"]) {
      expect(row(title).textContent).toContain("Open · optional");
    }
    expect(row("Arrive and settle").textContent).not.toContain("does not report");
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
