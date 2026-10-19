import { describe, expect, test } from "bun:test";
import { type AppEventName, emittedToday } from "@/infrastructure/app-events";
import { storyFixture as story } from "@/test/story";
import { type StoryState, applyEvent, emptyStoryState, storyProgress } from "./engine";

const started: StoryState = { ...emptyStoryState, choice: "story" };

function play(events: AppEventName[], from: StoryState = started): StoryState {
  return events.reduce((state, event) => applyEvent(story, state, event), from);
}

function statuses(state: StoryState, emitted: readonly AppEventName[] = emittedToday) {
  return Object.fromEntries(
    storyProgress(story, state, emitted).quests.map((q) => [q.quest.id, q.status]),
  );
}

describe("applyEvent", () => {
  test("steps complete only on their event and in order within a quest", () => {
    expect(play(["evidence_opened"]).done).toEqual([]);
    expect(play(["search_answered", "evidence_opened"]).done).toEqual([
      "find-experts/ask",
      "find-experts/evidence",
    ]);
  });

  test("a repeated event changes nothing and returns the same state", () => {
    const once = play(["search_answered"]);
    expect(applyEvent(story, once, "search_answered")).toBe(once);
  });

  test("an event counts in every quest where it is the next step", () => {
    expect(play(["brief_answered", "report_made"]).done).toEqual(["brief/upload", "brief/report"]);
  });
});

describe("storyProgress", () => {
  test("quests whose events nothing emits yet are coming next and never current", () => {
    expect(statuses(started)).toEqual({
      arrive: "coming",
      "find-experts": "current",
      "other-words": "ready",
      brief: "ready",
      visit: "ready",
      honest: "ready",
      extend: "coming",
      grow: "coming",
    });
  });

  test("the next unfinished quest becomes current, and finished criteria are listed", () => {
    const state = play(["search_answered", "evidence_opened"]);
    const progress = storyProgress(story, state, emittedToday);
    expect(progress.current?.quest.id).toBe("other-words");
    expect(progress.current?.nextStep?.id).toBe("ask-again");
    expect(progress.finishedCriteria).toEqual(["c1-right-people"]);
  });

  test("a jump to another quest makes it current until it is done", () => {
    const focused = { ...started, focus: "honest" };
    expect(storyProgress(story, focused, emittedToday).current?.quest.id).toBe("honest");
    const done = play(["abstained_seen"], focused);
    expect(storyProgress(story, done, emittedToday).current?.quest.id).toBe("find-experts");
  });

  test("a finished quest stays finished, even after the story stops listing its event", () => {
    const state = play(["abstained_seen"]);
    expect(statuses(state, [])["honest"]).toBe("done");
  });

  test("when every playable quest is done there is no current quest", () => {
    const state = play([
      "search_answered",
      "evidence_opened",
      "search_answered_other_language",
      "brief_answered",
      "report_made",
      "abstained_seen",
      "lobby_entered",
    ]);
    const progress = storyProgress(story, state, emittedToday);
    expect(progress.current).toBeNull();
    expect(progress.finishedCriteria).toEqual([
      "c1-right-people",
      "c2-wording",
      "c3-traceable",
      "c4-structured",
      "ethics-abstain",
    ]);
  });
});
