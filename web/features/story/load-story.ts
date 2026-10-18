import storyJson from "../../../contracts/fixtures/story.json";
import type { Story } from "@/infrastructure/contract-types.generated";
import { parseStory } from "@/infrastructure/contract";

// Parsed on the server, so the browser gets plain data and never loads the schema validator.
export function loadStory(): Story {
  const story = parseStory(storyJson);
  if (story === null)
    throw new Error("contracts/fixtures/story.json does not match quest.schema.json");
  return story;
}
