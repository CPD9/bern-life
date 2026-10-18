import { expect, test } from "bun:test";
import storyJson from "../../../contracts/fixtures/story.json";
import { emittedToday } from "@/infrastructure/app-events";
import { parseStory } from "@/infrastructure/contract";

test("story.json matches the quest contract, so every step names a known event", () => {
  expect(parseStory(storyJson)?.id).toBe("move-to-bern");
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
