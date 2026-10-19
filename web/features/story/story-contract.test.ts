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

test("each step says what completes it, keyed by the event", () => {
  const said = Object.fromEntries(
    story.quests.flatMap((quest) => quest.steps.map((step) => [step.done_when, step.text])),
  );
  expect(said).toEqual({
    settled: "Choose a plot for your office and settle there.",
    office_ready:
      "After setting up your profile, go to your office on the Home tab or sit down at its desk.",
    search_answered: "Ask the Navigator in your own words and get a result.",
    evidence_opened: "Open the sentence that proves a result.",
    search_answered_other_language: "Ask again in German or French and get a result.",
    brief_answered: "Upload or paste your brief and get matches back.",
    report_made: "Make a match report: every match keeps its sentence and source link.",
    lobby_entered: "Open a place on the map.",
    abstained_seen: "Ask about a professor who does not exist.",
    source_added: "Add an institution's website as a new source.",
    numbers_seen:
      "Open the Garage on your office computer and see the evaluator's numbers for this snapshot.",
    opportunity_saved: "Save a funding call, a service or a space to your library.",
    connection_saved: "Connect with another member: accept their request, or have yours accepted.",
    library_item_saved: "Save a person or an opportunity to your library from a result card.",
    message_sent: "Send a message to another member in Messages.",
    garage_visited: "Open the Garage on your office computer.",
  });
});
