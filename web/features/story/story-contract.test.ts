import { expect, test } from "bun:test";
import storyJson from "../../../contracts/fixtures/story.json";
import { emittedToday } from "@/infrastructure/app-events";
import { parseStory } from "@/infrastructure/contract";
import { emptyStoryState, storyProgress } from "./engine";

const story = parseStory(storyJson)!;

test("story.json matches the quest contract, so every step names a known event", () => {
  expect(story.id).toBe("move-to-bern");
  const broken = structuredClone(storyJson);
  (broken.quests[0]!.steps[0] as { done_when: string }).done_when = "ticked_a_box";
  expect(parseStory(broken)).toBeNull();
});

test("every event emitted today completes some step of the story", () => {
  const used = new Set(
    storyJson.quests.flatMap((quest) => quest.steps.map((step) => step.done_when)),
  );
  expect(emittedToday.filter((event) => !used.has(event))).toEqual([]);
});

test("every required quest can be finished with the events emitted today", () => {
  const emitted = new Set(emittedToday);
  const unfinishable = story.quests
    .filter((quest) => !quest.optional)
    .filter((quest) => quest.steps.some((step) => !emitted.has(step.done_when)))
    .map((quest) => quest.id);
  expect(unfinishable).toEqual([]);
});

test("every quest that is coming next today says why in one line", () => {
  const coming = storyProgress(story, emptyStoryState, emittedToday).quests.filter(
    (entry) => entry.status === "coming",
  );
  expect(coming.filter((entry) => !entry.quest.coming).map((entry) => entry.quest.id)).toEqual([]);
});
