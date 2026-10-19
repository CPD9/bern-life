import { describe, expect, test } from "bun:test";
import { emittedToday } from "@/infrastructure/app-events";
import type { Story } from "@/infrastructure/contract-types.generated";
import { defaultBear } from "@/features/avatar/bear-config";
import { emptyProfile } from "@/features/onboarding/profile";
import { emptyStoryState, storyProgress } from "@/features/story/engine";
import { storyFixture } from "@/test/story";
import {
  bearFacts,
  expertiseOf,
  furColour,
  personFacts,
  profileFacts,
  readableId,
  storyTally,
} from "./you-summary";

describe("you summary", () => {
  test("an empty profile says what is not chosen yet and stays private", () => {
    expect(profileFacts(emptyProfile)).toEqual([
      { label: "Role", value: "Not chosen yet" },
      { label: "Goal", value: "Not chosen yet" },
      { label: "Who sees your profile", value: "Only me" },
    ]);
  });

  test("answers read as their onboarding labels", () => {
    const facts = profileFacts({ role: "company", goal: "funding", visibility: "members" });
    expect(facts.map((fact) => fact.value)).toEqual([
      "Company or start-up",
      "Find funding or a call",
      "People who join Bern Life",
    ]);
  });

  test("a person's look reads from its ids", () => {
    expect(readableId("lab-coat")).toBe("Lab coat");
    expect(
      personFacts({
        body: "medium",
        skin: "tone-4",
        hair: "bun",
        outfit: "lab-coat",
        accent: "teal",
      }),
    ).toEqual([
      { label: "Build", value: "Medium" },
      { label: "Skin", value: "Tone 4" },
      { label: "Hair", value: "Bun" },
      { label: "Outfit", value: "Lab coat" },
      { label: "Accent", value: "Teal" },
    ]);
  });

  test("the bear's look uses the avatar labels and its fur colour", () => {
    expect(bearFacts(defaultBear)).toEqual([
      { label: "Kind", value: "Bern bear" },
      { label: "Fur", value: "Honey" },
      { label: "Face", value: "Happy" },
      { label: "Outfit", value: "Casual" },
      { label: "Accessory", value: "Scarf" },
    ]);
    expect(furColour(defaultBear)).toBe("#b97a45");
  });

  test("the tally counts done quests out of required ones only", () => {
    const [first, ...rest] = storyFixture.quests;
    if (!first) throw new Error("the story fixture has no quests");
    const story: Story = { ...storyFixture, quests: [{ ...first, optional: true }, ...rest] };
    const done = ["find-experts/ask", "find-experts/evidence", "arrive/settle", "arrive/office"];
    const progress = storyProgress(story, { ...emptyStoryState, done }, emittedToday);
    expect(storyTally(progress)).toEqual({ done: 1, required: 4 });
  });

  test("expertise is trimmed, without blanks or repeats", () => {
    const profile = { ...emptyProfile, expertise: [" glucose sensors", "", "CGM", "CGM "] };
    expect(expertiseOf(profile)).toEqual(["glucose sensors", "CGM"]);
    expect(expertiseOf(emptyProfile)).toEqual([]);
  });
});
