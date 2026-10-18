import { describe, expect, test } from "bun:test";
import { displayFrom } from "./display";

const quiet = { theme: null, graphics: null, prefersDark: false, prefersReducedMotion: false };

describe("displayFrom", () => {
  test("the night setting overrides the OS, and the OS decides when no setting is written", () => {
    expect(displayFrom({ ...quiet, theme: "night" }).night).toBe(true);
    expect(displayFrom({ ...quiet, theme: "day", prefersDark: true }).night).toBe(false);
    expect(displayFrom({ ...quiet, prefersDark: true }).night).toBe(true);
    expect(displayFrom(quiet).night).toBe(false);
  });

  test("lite graphics only for data-graphics=lite; reduced motion from the OS", () => {
    expect(displayFrom({ ...quiet, graphics: "lite" }).lite).toBe(true);
    expect(displayFrom({ ...quiet, graphics: "full" }).lite).toBe(false);
    expect(displayFrom({ ...quiet, prefersReducedMotion: true }).reducedMotion).toBe(true);
  });
});
