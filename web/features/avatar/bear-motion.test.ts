import { describe, expect, test } from "bun:test";
import { STILL, eyesOpenAt, idlePose, motionFor, poseAt, walkPose } from "./bear-motion";

const round = (value: number) => Math.round(value * 1000) / 1000;

describe("walkPose", () => {
  test("at the start of a stride the bear stands upright, feet together", () => {
    const pose = walkPose(0);
    expect([round(pose.rock), round(pose.lift), pose.legs, pose.arms]).toEqual([
      0,
      0,
      [0, -0],
      [-0, 0],
    ]);
  });

  test("a quarter stride in, it rocks to one side with legs and arms swinging opposite", () => {
    const pose = walkPose(0.25);
    expect([round(pose.rock), round(pose.legs[0]), round(pose.legs[1])]).toEqual([0.13, 0.5, -0.5]);
    expect([round(pose.arms[0]), round(pose.arms[1])]).toEqual([-0.45, 0.45]);
    expect(round(pose.lift)).toBe(0.02);
  });

  test("it hops on every third stride only, and stretches while in the air", () => {
    const midStride = (stride: number) => walkPose(stride + 0.5);
    expect([0, 1, 2, 3, 4, 5].map((stride) => round(midStride(stride).lift))).toEqual([
      0, 0, 0.06, 0, 0, 0.06,
    ]);
    expect(round(midStride(2).squash)).toBe(1.048);
  });

  test("it squishes a little as each foot lands", () => {
    expect(round(walkPose(0).squash)).toBe(0.96);
    expect(round(walkPose(0.5).squash)).toBe(0.96);
  });
});

describe("idlePose", () => {
  test("standing, it breathes: a small rise and swell, and no stepping", () => {
    const pose = idlePose(0.75);
    expect([round(pose.lift), round(pose.squash), pose.legs]).toEqual([0.012, 1.015, [0, 0]]);
  });
});

describe("eyesOpenAt", () => {
  test("the eyes close briefly every 4.2 seconds and are open in between", () => {
    expect(round(eyesOpenAt(0.07))).toBe(0.1);
    expect(eyesOpenAt(1)).toBe(1);
    expect(round(eyesOpenAt(4.2 + 0.07))).toBe(0.1);
  });
});

describe("motionFor and poseAt", () => {
  test("reduced motion always gives a still bear", () => {
    expect(motionFor("walk", true)).toBe("still");
    expect(motionFor("idle", true)).toBe("still");
    expect(motionFor("walk", false)).toBe("walk");
    expect(poseAt("still", 12.3)).toEqual(STILL);
  });
});
