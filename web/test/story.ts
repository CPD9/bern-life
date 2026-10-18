import storyJson from "../../contracts/fixtures/story.json";
import { parseStory } from "@/infrastructure/contract";
import type { Story } from "@/infrastructure/contract-types.generated";

const parsed = parseStory(storyJson);
if (parsed === null) throw new Error("story.json does not match quest.schema.json");

export const storyFixture: Story = parsed;
