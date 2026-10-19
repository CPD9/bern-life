import { expect, test } from "bun:test";
import type { QuestStep } from "./engine";
import { showMeTarget } from "./show-me";

const step = (done_when: QuestStep["done_when"]): QuestStep => ({
  id: "s",
  text: "Demo step.",
  done_when,
});

test("each step goes where it can be done: settling, saving, or none for the desk-only garage", () => {
  expect(showMeTarget(step("settled"))).toBe("settle");
  expect(showMeTarget(step("opportunity_saved"))).toBe("opportunities");
  expect(showMeTarget(step("library_item_saved"))).toBe("opportunities");
  expect(showMeTarget(step("lobby_entered"))).toBe("map");
  expect(showMeTarget(step("search_answered"))).toBe("ask");
  expect(showMeTarget(step("garage_visited"))).toBeNull();
});
