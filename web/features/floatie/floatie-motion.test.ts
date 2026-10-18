import { describe, expect, test } from "bun:test";
import { RESTING, blinkAt, idlePose, listeningPose, poseAt, shownState } from "./floatie-motion";

const round = (value: number) => Math.round(value * 1000) / 1000;

describe("idlePose", () => {
  test("a quarter of the way through a bob it is at its highest and a little brighter", () => {
    const pose = idlePose(0.6);
    expect([round(pose.lift), round(pose.glow), round(pose.halo)]).toEqual([0.04, 1.1, 1.05]);
    expect([pose.lean, pose.ripple.opacity]).toEqual([0, 0]);
  });

  test("the wings flutter three times a second around a slightly raised rest", () => {
    expect([0, 1 / 12, 3 / 12].map((s) => round(idlePose(s).wings))).toEqual([0.3, 0.65, -0.05]);
  });
});

describe("listeningPose", () => {
  test("it leans in, glows brighter and opens its eyes wide", () => {
    const pose = listeningPose(1);
    expect([pose.lean, pose.glow, pose.halo, pose.eyes]).toEqual([0.18, 1.6, 1.25, 1.2]);
  });

  test("the ripple grows from the core and fades out every 1.2 seconds", () => {
    const rippleAt = (s: number) => {
      const { scale, opacity } = listeningPose(s).ripple;
      return [round(scale), round(opacity)];
    };
    expect(rippleAt(1.2)).toEqual([1, 0.5]);
    expect(rippleAt(1.8)).toEqual([1.5, 0.25]);
    expect(rippleAt(2.34)).toEqual([1.95, 0.025]);
  });
});

describe("blinkAt", () => {
  test("the eyes close briefly every 3.6 seconds and are open in between", () => {
    expect(round(blinkAt(0.08))).toBe(0.1);
    expect(blinkAt(1)).toBe(1);
    expect(round(blinkAt(3.6 + 0.08))).toBe(0.1);
  });
});

describe("poseAt", () => {
  test("reduced motion holds a fixed pose whatever the time", () => {
    expect(poseAt("idle", 0.6, true)).toEqual(RESTING.idle);
    expect(poseAt("idle", 7.3, true)).toEqual(RESTING.idle);
    expect(poseAt("listening", 1.8, true)).toEqual(RESTING.listening);
  });

  test("without moving, listening still reads: brighter, leaning in, one still ring", () => {
    const { glow, lean, ripple } = RESTING.listening;
    expect([glow, lean, ripple.opacity]).toEqual([1.6, 0.18, 0.3]);
    expect(RESTING.idle.ripple.opacity).toBe(0);
  });

  test("with motion it follows the state it is in", () => {
    expect(poseAt("idle", 0.6, false)).toEqual(idlePose(0.6));
    expect(poseAt("listening", 0.6, false)).toEqual(listeningPose(0.6));
  });
});

describe("shownState", () => {
  test("it listens when asked, pointed at or focused, and is idle otherwise", () => {
    expect(shownState("idle", false, false)).toBe("idle");
    expect(shownState("idle", true, false)).toBe("listening");
    expect(shownState("idle", false, true)).toBe("listening");
    expect(shownState("listening", false, false)).toBe("listening");
  });
});
