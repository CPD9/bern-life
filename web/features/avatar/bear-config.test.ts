import { describe, expect, test } from "bun:test";
import { defaultBear, furOptions, parseBear, shuffleBear, withKind } from "./bear-config";

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("shuffleBear", () => {
  test("draws kind, then a fur of that kind, then face, outfit and accessory", () => {
    expect(shuffleBear(sequence(0.4, 0.99, 0.55, 0.5, 0.99))).toEqual({
      kind: "panda",
      fur: "qinling",
      face: "sleepy",
      outfit: "lab-coat",
      accessory: "backpack",
    });
  });
});

describe("withKind", () => {
  test("switching kind moves the fur to that kind's first shade and keeps the rest", () => {
    expect(withKind({ ...defaultBear, fur: "cocoa", face: "wink" }, "polar-bear")).toEqual({
      ...defaultBear,
      kind: "polar-bear",
      fur: "snow",
      face: "wink",
    });
  });
});

describe("furOptions", () => {
  test("each kind has its own shades, and the Bern bear comes first in honey", () => {
    expect(furOptions("brown-bear").map((option) => option.id)).toEqual([
      "honey",
      "chestnut",
      "cocoa",
      "golden",
    ]);
    expect(furOptions("ibex").map((option) => option.id)).toEqual(["fawn", "stone"]);
  });
});

describe("parseBear", () => {
  test("keeps a valid config and drops fields it does not know", () => {
    expect(parseBear({ ...defaultBear, name: "Bärli" })).toEqual(defaultBear);
  });

  test("rejects a fur that belongs to another kind", () => {
    expect(parseBear({ ...defaultBear, kind: "panda", fur: "honey" })).toBeNull();
  });

  test("rejects unknown ids, wrong types and the older human avatar", () => {
    expect(parseBear({ ...defaultBear, accessory: "crown" })).toBeNull();
    expect(parseBear({ ...defaultBear, face: 2 })).toBeNull();
    expect(parseBear({ body: "medium", skin: "tone-4", hair: "short" })).toBeNull();
    expect(parseBear(null)).toBeNull();
  });
});
