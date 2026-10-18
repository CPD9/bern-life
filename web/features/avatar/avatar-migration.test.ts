import { describe, expect, test } from "bun:test";
import { migrateHumanAvatar } from "./avatar-migration";

const human = { body: "medium", skin: "tone-4", hair: "short", outfit: "office", accent: "green" };

describe("migrateHumanAvatar", () => {
  test("a saved human figure becomes a Bern bear in the same outfit", () => {
    expect(migrateHumanAvatar(human)).toEqual({
      kind: "brown-bear",
      fur: "honey",
      face: "happy",
      outfit: "office",
      accessory: "none",
    });
  });

  test("fur follows the skin tone from light to deep", () => {
    const furFor = (skin: string) => migrateHumanAvatar({ ...human, skin })?.fur;
    expect(["tone-1", "tone-3", "tone-6", "tone-7", "tone-8", "tone-10"].map(furFor)).toEqual([
      "golden",
      "golden",
      "honey",
      "chestnut",
      "chestnut",
      "cocoa",
    ]);
  });

  test("anything that is not a complete human figure is left alone", () => {
    expect(migrateHumanAvatar({ ...human, skin: "tone-11" })).toBeNull();
    expect(migrateHumanAvatar({ ...human, outfit: "spacesuit" })).toBeNull();
    expect(migrateHumanAvatar({ skin: "tone-4", outfit: "casual" })).toBeNull();
    expect(migrateHumanAvatar("tone-4")).toBeNull();
  });
});
