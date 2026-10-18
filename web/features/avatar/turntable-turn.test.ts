import { describe, expect, test } from "bun:test";
import { angleAfterKey, degreesOf, turnLabel } from "./turntable-turn";

describe("turntable keys", () => {
  test("the arrows turn in 15 degree steps and Home faces the player again", () => {
    const left = angleAfterKey(0, "ArrowLeft");
    expect(left === null ? null : degreesOf(left)).toBe(345);
    const twiceRight = [0, 0].reduce((angle) => angleAfterKey(angle, "ArrowRight") ?? angle, 0);
    expect(degreesOf(twiceRight)).toBe(30);
    expect(angleAfterKey(2.5, "Home")).toBe(0);
  });

  test("other keys are left to the page", () => {
    expect(angleAfterKey(1, "Tab")).toBeNull();
    expect(angleAfterKey(1, "ArrowUp")).toBeNull();
  });

  test("the slider reads whole degrees in 0 to 359 with a plain label", () => {
    expect(degreesOf(-Math.PI / 2)).toBe(270);
    expect(degreesOf(Math.PI * 2)).toBe(0);
    expect(turnLabel(0)).toBe("Facing you");
    expect(turnLabel(90)).toBe("Turned 90 degrees");
  });
});
