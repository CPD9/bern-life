import { describe, expect, test } from "bun:test";
import {
  accentOptions,
  defaultPerson,
  parsePerson,
  personBadgeColour,
  shufflePerson,
} from "./person-config";

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

// WCAG relative luminance, so the badge test checks the same bar as the UI standard (4.5:1).
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

describe("personBadgeColour", () => {
  test("is the person's accent", () => {
    expect(personBadgeColour(defaultPerson)).toBe("#2f9e5f");
    expect(personBadgeColour({ ...defaultPerson, accent: "rose" })).toBe("#da5e90");
  });

  test("every accent reaches 4.5:1 with the badge's dark or white ink", () => {
    const short = accentOptions
      .map((option) => personBadgeColour({ ...defaultPerson, accent: option.id }))
      .filter((colour) => Math.max(contrast(colour, "#14202b"), contrast(colour, "#ffffff")) < 4.5);
    expect(short).toEqual([]);
  });
});
