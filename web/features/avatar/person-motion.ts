// How a person moves, as plain numbers for a moment in time, like the bear (bear-motion.ts). Walking
// is an easy stride: legs swing from the hip, arms swing against them, and the body bobs a little
// on each step. Standing idle it only breathes. The same Motion and motionFor rules as the bear:
// still under reduced motion, and no idle loop with lite graphics.

import { type Motion } from "./bear-motion";

export type PersonPose = {
  /** Lift of the whole figure, in metres. */
  readonly lift: number;
  /** Forward lean, in radians. */
  readonly lean: number;
  /**
   * Swing of each leg from the hip and each arm from the shoulder, in radians, as [right, left].
   * The figure faces +z, so its right side is -x; positive swings the limb back.
   */
  readonly legs: readonly [number, number];
  readonly arms: readonly [number, number];
};

export const STANDING: PersonPose = { lift: 0, lean: 0, legs: [0, 0], arms: [0, 0] };

const TAU = Math.PI * 2;
/** A little quicker than the bear's waddle; one stride is a left and a right step. */
export const PERSON_STEPS_PER_SECOND = 2.4;
const BREATH_SECONDS = 3.4;

export function personWalkPose(seconds: number): PersonPose {
  const swing = Math.sin(((seconds * PERSON_STEPS_PER_SECOND) / 2) * TAU);
  return {
    // Highest twice a stride, as each leg passes under the body.
    lift: 0.025 * (1 - Math.abs(swing)),
    lean: 0.06,
    legs: [0.5 * swing, -0.5 * swing],
    arms: [-0.4 * swing, 0.4 * swing],
  };
}

export function personIdlePose(seconds: number): PersonPose {
  const breath = Math.sin((seconds / BREATH_SECONDS) * TAU);
  return { lift: 0.004 * (breath + 1), lean: 0, legs: [0, 0], arms: [0.03 * breath, 0.03 * breath] };
}

export function personPoseAt(motion: Motion, seconds: number): PersonPose {
  if (motion === "walk") return personWalkPose(seconds);
  if (motion === "idle") return personIdlePose(seconds);
  return STANDING;
}
