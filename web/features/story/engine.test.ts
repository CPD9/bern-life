import { describe, expect, test } from "bun:test";
import { type AppEventName, emittedToday } from "@/infrastructure/app-events";
import type { Story } from "@/infrastructure/contract-types.generated";
import { storyFixture as story } from "@/test/story";
import {
  type StoryState,
  applyEvent,
  comingReason,
  defaultComingReason,
  emptyStoryState,
  storyProgress,
} from "./engine";

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

  test("an optional quest's steps complete in any order, each once", () => {
    const state = play(["message_sent", "opportunity_saved", "message_sent", "garage_visited"]);
    expect(state.done).toEqual(["grow/message", "grow/opportunity", "grow/garage"]);
    expect(play(["office_ready"]).done).toEqual(["arrive/office"]);
  });

  test("a required quest still waits for its earlier steps", () => {
    const [first, ...rest] = story.quests;
    const required: Story = {
      ...story,
      quests: [{ ...first, optional: false }, ...rest.map((q) => ({ ...q, optional: false }))],
    };
    expect(applyEvent(required, started, "office_ready")).toBe(started);
    expect(applyEvent(required, started, "garage_visited")).toBe(started);
  });
});

describe("optional quests in any order", () => {
  const grow = (state: StoryState, emitted: readonly AppEventName[]) =>
    storyProgress(story, state, emitted).quests.find((q) => q.quest.id === "grow")!;

  // Finding experts stays open, so Grow is merely ready, not current.
  const messagesOnly: AppEventName[] = ["search_answered", "evidence_opened", "message_sent"];

  test("one playable step is enough to open the quest, and that step is offered next", () => {
    const entry = grow(started, messagesOnly);
    expect(entry.status).toBe("ready");
    expect(entry.nextStep?.id).toBe("message");
    expect(entry.stepsDone).toBe(0);
  });

  test("once its playable steps are done it waits again, counting what was done", () => {
    const entry = grow(play(["message_sent"]), messagesOnly);
    expect(entry.status).toBe("coming");
    expect(entry.nextStep?.id).toBe("opportunity");
    expect(entry.stepsDone).toBe(1);
  });

  test("an open optional quest is current only when no required quest is open", () => {
    const everyEvent = story.quests.flatMap((q) => q.steps.map((step) => step.done_when));
    const progress = storyProgress(story, started, everyEvent);
    expect(progress.current?.quest.id).toBe("find-experts");
    const requiredDone = play([
      "search_answered",
      "evidence_opened",
      "search_answered_other_language",
      "brief_answered",
      "report_made",
      "abstained_seen",
    ]);
    expect(storyProgress(story, requiredDone, everyEvent).current?.quest.id).toBe("arrive");
  });
});

describe("comingReason", () => {
  test("uses the story's own line and falls back to a plain one", () => {
    const extend = story.quests.find((q) => q.id === "extend")!;
    expect(comingReason(extend)).toBe(
      "Adding a source does not report to the story yet; a new site is one file in sources/.",
    );
    const withoutReason = { ...extend };
    delete withoutReason.coming;
    expect(comingReason(withoutReason)).toBe(defaultComingReason);
  });

  test("a quest whose events are all emitted carries no coming reason", () => {
    const visit = story.quests.find((q) => q.id === "visit")!;
    expect(visit.coming).toBeUndefined();
  });

  test("Arrive carries no coming reason now that settling reports to the story", () => {
    const arrive = story.quests.find((q) => q.id === "arrive")!;
    expect(arrive.coming).toBeUndefined();
  });

  test("Arrive is open in full: once the office is ready, settling is offered next", () => {
    const arrive = (state: StoryState) =>
      storyProgress(story, state, emittedToday).quests.find((q) => q.quest.id === "arrive")!;
    expect(arrive(started).status).toBe("ready");
    const afterOffice = arrive(play(["office_ready"]));
    expect([afterOffice.status, afterOffice.nextStep?.id, afterOffice.stepsDone]).toEqual([
      "ready",
      "settle",
      1,
    ]);
    expect(arrive(play(["office_ready", "settled"])).status).toBe("done");
  });
});

describe("storyProgress", () => {
  test("quests whose events nothing emits yet are coming next and never current", () => {
    const withoutNumbers = emittedToday.filter((event) => event !== "numbers_seen");
    expect(statuses(started, withoutNumbers)["extend"]).toBe("coming");
    expect(statuses(started)).toEqual({
      arrive: "ready",
      "find-experts": "current",
      "other-words": "ready",
      brief: "ready",
      visit: "ready",
      honest: "ready",
      extend: "ready",
      grow: "ready",
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
      "message_sent",
      "office_ready",
      "settled",
      "opportunity_saved",
      "library_item_saved",
      "garage_visited",
      "numbers_seen",
    ]);
    const progress = storyProgress(story, state, emittedToday);
    expect(progress.current).toBeNull();
    expect(progress.finishedCriteria).toEqual([
      "stretch",
      "c1-right-people",
      "c2-wording",
      "c3-traceable",
      "c4-structured",
      "ethics-abstain",
    ]);
  });
});
