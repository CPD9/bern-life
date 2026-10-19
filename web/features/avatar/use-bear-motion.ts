// Moves the bear's parts each frame from the pose maths. Parts are found by name inside the bear,
// so no refs travel through props. The canvas renders on demand: the bear asks for the next frame
// only while it moves, and a still bear stops asking. A loop that has stopped never sees a new
// motion, so a change of motion asks for one frame to start it again.

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useRef } from "react";
import { type Group, type Object3D } from "three";
import { type BearPose, type Motion, poseAt } from "./bear-motion";

/**
 * Names of the moving parts; the figure's parts carry them as their `name`. Pairs run [right,
 * left] from the bear's point of view, like the pose: the bear faces +z, so its right is -x.
 */
export const PART = {
  head: "bear-head",
  arms: ["bear-arm-right", "bear-arm-left"],
  legs: ["bear-leg-right", "bear-leg-left"],
  tail: "bear-tail",
  eyes: ["bear-eye-right", "bear-eye-left"],
} as const;

function applyPose(root: Group, pose: BearPose) {
  const part = (name: string): Object3D | undefined => root.getObjectByName(name);
  root.position.y = pose.lift;
  root.rotation.set(pose.lean, 0, pose.rock);
  root.scale.set(1, pose.squash, 1);
  part(PART.head)?.rotation.set(0, 0, pose.headTilt);
  PART.arms.forEach((name, index) => part(name)?.rotation.set(pose.arms[index] ?? 0, 0, 0));
  PART.legs.forEach((name, index) => part(name)?.rotation.set(pose.legs[index] ?? 0, 0, 0));
  part(PART.tail)?.rotation.set(0, pose.tail, 0);
  PART.eyes.forEach((name) => part(name)?.scale.set(1, pose.eyes, 1));
}

/** Asks for one frame whenever the motion changes, so a stopped loop starts or settles. */
export function useFrameOnMotionChange(motion: Motion, invalidate: () => void): void {
  useEffect(() => {
    invalidate();
  }, [motion, invalidate]);
}

export function useBearMotion(motion: Motion): RefObject<Group | null> {
  const root = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  useFrameOnMotionChange(motion, invalidate);
  useFrame((state) => {
    if (root.current === null) return;
    applyPose(root.current, poseAt(motion, state.clock.getElapsedTime()));
    if (motion !== "still") state.invalidate();
  });
  return root;
}
