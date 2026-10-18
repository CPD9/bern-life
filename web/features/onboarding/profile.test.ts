import { describe, expect, test } from "bun:test";
import { emptyProfile, goalLabel, parseProfile } from "./profile";

describe("parseProfile", () => {
  test("keeps known answers", () => {
    const profile = { role: "company", goal: "test-site", visibility: "members" } as const;
    expect(parseProfile(profile)).toEqual(profile);
  });

  test("unknown or wrongly typed answers fall back, and visibility falls back to private", () => {
    expect(parseProfile({ role: "astronaut", goal: 4, visibility: "public" })).toEqual(
      emptyProfile,
    );
    expect(parseProfile(null)).toEqual(emptyProfile);
  });
});

describe("goalLabel", () => {
  test("gives the short HUD text, or nothing without a goal", () => {
    expect(goalLabel("test-site")).toBe("Find a test site");
    expect(goalLabel(null)).toBeNull();
  });
});
