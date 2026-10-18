import { describe, expect, test } from "bun:test";
import { defaultAvatar, parseAvatar, shuffleAvatar } from "./avatar-config";

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("shuffleAvatar", () => {
  test("draws body, skin, hair, outfit and accent in that order", () => {
    expect(shuffleAvatar(sequence(0, 0.99, 0.5, 0.3, 0.9))).toEqual({
      body: "slim",
      skin: "tone-10",
      hair: "bun",
      outfit: "office",
      accent: "slate",
    });
  });
});

describe("parseAvatar", () => {
  test("keeps a valid config and drops fields it does not know", () => {
    expect(parseAvatar({ ...defaultAvatar, name: "Ada" })).toEqual(defaultAvatar);
  });

  test("rejects an unknown option id", () => {
    expect(parseAvatar({ ...defaultAvatar, outfit: "spacesuit" })).toBeNull();
  });

  test("rejects wrong types and missing fields", () => {
    expect(parseAvatar({ ...defaultAvatar, skin: 4 })).toBeNull();
    expect(parseAvatar({ body: "slim" })).toBeNull();
    expect(parseAvatar(null)).toBeNull();
    expect(parseAvatar("medium")).toBeNull();
  });
});
