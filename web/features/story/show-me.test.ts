import { expect, test } from "bun:test";
import { storyFixture as story } from "@/test/story";
import { stepKey } from "./engine";
import { showMeTarget } from "./show-me";

test("Show me takes each step of the story to where it is done", () => {
  const targets = Object.fromEntries(
    story.quests.flatMap((quest) =>
      quest.steps.map((step) => [stepKey(quest, step), showMeTarget(step)]),
    ),
  );
  expect(targets).toEqual({
    "arrive/settle": "settle",
    "arrive/office": null,
    "find-experts/ask": "ask",
    "find-experts/evidence": "ask",
    "other-words/ask-again": "ask",
    "brief/upload": "ask",
    "brief/report": "ask",
    "visit/lobby": "map",
    "honest/invented": "ask",
    "extend/source": null,
    "extend/numbers": null,
    "grow/opportunity": "opportunities",
    "grow/connection": null,
    "grow/library": "opportunities",
    "grow/message": null,
    "grow/garage": null,
  });
});
