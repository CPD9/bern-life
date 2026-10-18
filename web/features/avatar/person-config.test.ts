import { describe, expect, test } from "bun:test";
import { defaultPerson, parsePerson, shufflePerson } from "./person-config";

function sequence(...values: number[]): () => number {
  let index = 0;
  return () => values[index++] ?? 0;
}

describe("shufflePerson", () => {
  test("draws body, skin, hair, outfit and accent in that order", () => {
    expect(shufflePerson(sequence(0, 0.99, 0.5, 0.3, 0.9))).toEqual({
      body: "slim",
      skin: "tone-10",
      hair: "bun",
      outfit: "office",
      accent: "slate",
    });
  });
});

describe("parsePerson", () => {
  test("keeps a valid config and drops fields it does not know", () => {
    expect(parsePerson({ ...defaultPerson, name: "Ada" })).toEqual(defaultPerson);
  });

  test("rejects an unknown option id", () => {
    expect(parsePerson({ ...defaultPerson, outfit: "spacesuit" })).toBeNull();
  });

  test("rejects wrong types and missing fields", () => {
    expect(parsePerson({ ...defaultPerson, skin: 4 })).toBeNull();
    expect(parsePerson({ body: "slim" })).toBeNull();
    expect(parsePerson(null)).toBeNull();
    expect(parsePerson("medium")).toBeNull();
  });
});
