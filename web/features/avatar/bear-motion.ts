// How the bear moves, as plain numbers for a moment in time, so the motion can be checked exactly
// without three.js. Standing, it breathes, sways and blinks. Walking, it waddles like a toddler in
// a big raincoat: a heavy side-to-side rock on short, quick steps, a small squish as each foot
// lands, and a little hop every third stride. Every kind walks the same way.

export type Motion = "still" | "idle" | "walk";

export type BearPose = {
  /** Lift of the whole bear, in metres. */
  readonly lift: number;
  /** Side-to-side rock around the feet, in radians (positive leans to the bear's right, -x). */
  readonly rock: number;
  /** Forward lean, in radians. */
  readonly lean: number;
  /** Vertical scale of the whole bear: below 1 squishes, above 1 stretches. */
  readonly squash: number;
  readonly headTilt: number;
  /**
   * Forward and back swing of each leg and arm, in radians, as [right, left]. The bear faces +z,
   * so its right side is -x.
   */
  readonly legs: readonly [number, number];
  readonly arms: readonly [number, number];
  readonly tail: number;
  /** How open the open-style eyes are, 1 open and close to 0 mid-blink. */
  readonly eyes: number;
};

export const STILL: BearPose = {
  lift: 0,
  rock: 0,
  lean: 0,
  squash: 1,
  headTilt: 0,
  legs: [0, 0],
  arms: [0, 0],
  tail: 0,
  eyes: 1,
};

const TAU = Math.PI * 2;

/** Two steps a second; one stride is a left and a right step. */
export const STEPS_PER_SECOND = 2;
const HOP_EVERY_STRIDES = 3;
const HOP_HEIGHT = 0.06;
const BREATH_SECONDS = 3;
const BLINK_EVERY_SECONDS = 4.2;
const BLINK_SECONDS = 0.14;

/** Eyes shut briefly once every few seconds, the same way on every visit. */
export function eyesOpenAt(seconds: number): number {
  const sinceBlink = seconds % BLINK_EVERY_SECONDS;
  if (sinceBlink >= BLINK_SECONDS) return 1;
  return 0.1 + 0.9 * Math.abs(Math.cos((sinceBlink / BLINK_SECONDS) * Math.PI));
}

export function idlePose(seconds: number): BearPose {
  const breath = Math.sin((seconds / BREATH_SECONDS) * TAU);
  const drift = Math.sin((seconds / 7) * TAU);
  return {
    lift: 0.006 * (breath + 1),
    rock: 0.02 * drift,
    lean: 0,
    squash: 1 + 0.015 * breath,
    headTilt: 0.06 * drift,
    legs: [0, 0],
    arms: [0.04 * breath, 0.04 * breath],
    tail: 0.2 * Math.sin((seconds / 2.5) * TAU),
    eyes: eyesOpenAt(seconds),
  };
}

export function walkPose(seconds: number): BearPose {
  const strides = (seconds * STEPS_PER_SECOND) / 2;
  const phase = strides * TAU;
  const swing = Math.sin(phase);
  // A foot lands twice per stride, when the swing passes through zero.
  const landing = Math.abs(Math.cos(phase));
  const stride = Math.floor(strides);
  const hop =
    stride % HOP_EVERY_STRIDES === HOP_EVERY_STRIDES - 1
      ? HOP_HEIGHT * Math.sin((strides - stride) * Math.PI)
      : 0;
  return {
    lift: 0.02 * Math.abs(swing) + hop,
    rock: 0.13 * swing,
    lean: 0.08,
    squash: hop > 0 ? 1 + hop * 0.8 : 1 - 0.04 * landing,
    headTilt: -0.07 * swing,
    legs: [0.5 * swing, -0.5 * swing],
    arms: [-0.45 * swing, 0.45 * swing],
    tail: 0.3 * swing,
    eyes: eyesOpenAt(seconds),
  };
}

export function poseAt(motion: Motion, seconds: number): BearPose {
  if (motion === "walk") return walkPose(seconds);
  if (motion === "idle") return idlePose(seconds);
  return STILL;
}

/**
 * Reduced motion keeps the bear standing still, whatever it was asked to do. Lite graphics drops
 * the idle breathing, which would redraw every frame for ever, but still walks when asked.
 */
export function motionFor(
  wanted: Motion,
  { reducedMotion, lite }: { reducedMotion: boolean; lite: boolean },
): Motion {
  return reducedMotion || (lite && wanted === "idle") ? "still" : wanted;
}
