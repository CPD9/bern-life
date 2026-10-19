import { describe, expect, test } from "bun:test";
import { Group } from "three";
import { motionFor } from "./bear-motion";
import {
  PERSON_STEPS_PER_SECOND,
  personIdlePose,
  personPoseAt,
  personWalkPose,
  STANDING,
} from "./person-motion";
import { applyPersonPose, PERSON_PART } from "./use-person-motion";

const STRIDE = 2 / PERSON_STEPS_PER_SECOND;

describe("a person walking", () => {
  test("starts a stride with legs together, at the top of the bob", () => {
    expect(personWalkPose(0)).toEqual({ lift: 0.025, lean: 0.06, legs: [0, -0], arms: [-0, 0] });
  });

  test("a quarter stride in, the right leg is back and the right arm forward", () => {
    const pose = personWalkPose(STRIDE / 4);
    expect(pose.legs[0]).toBeCloseTo(0.5, 12);
    expect(pose.legs[1]).toBeCloseTo(-0.5, 12);
    expect(pose.arms[0]).toBeCloseTo(-0.4, 12);
    expect(pose.arms[1]).toBeCloseTo(0.4, 12);
    expect(pose.lift).toBeCloseTo(0, 12);
  });

  test("repeats every stride", () => {
    const later = personWalkPose(STRIDE * 3 + 0.1);
    const now = personWalkPose(0.1);
    expect(later.legs[0]).toBeCloseTo(now.legs[0], 9);
    expect(later.lift).toBeCloseTo(now.lift, 9);
  });
});

describe("standing", () => {
  test("still is every part at rest; idle only breathes, legs still", () => {
    expect(personPoseAt("still", 12.3)).toBe(STANDING);
    const idle = personIdlePose(3.4 / 4);
    expect(idle.lift).toBeCloseTo(0.008, 12);
    expect(idle.legs).toEqual([0, 0]);
    expect(idle.arms[0]).toBeCloseTo(0.03, 12);
  });

  test("reduced motion stands still even when walking; lite drops only the idle loop", () => {
    expect(motionFor("walk", { reducedMotion: true, lite: false })).toBe("still");
    expect(motionFor("idle", { reducedMotion: false, lite: true })).toBe("still");
    expect(motionFor("walk", { reducedMotion: false, lite: true })).toBe("walk");
  });
});

describe("posing the figure", () => {
  test("swings the named limbs about x and keeps the arms' outward tilt", () => {
    const root = new Group();
    const parts = [...PERSON_PART.legs, ...PERSON_PART.arms].map((name) => {
      const part = new Group();
      part.name = name;
      part.rotation.z = 0.45;
      root.add(part);
      return part;
    });
    applyPersonPose(root, { lift: 0.02, lean: 0.06, legs: [0.5, -0.5], arms: [-0.4, 0.4] });
    expect(root.position.y).toBe(0.02);
    expect(root.rotation.x).toBe(0.06);
    expect(parts.map((part) => part.rotation.x)).toEqual([0.5, -0.5, -0.4, 0.4]);
    expect(parts.map((part) => part.rotation.z)).toEqual([0.45, 0.45, 0.45, 0.45]);
  });
});
