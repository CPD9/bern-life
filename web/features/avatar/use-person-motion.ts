// Moves a person's legs, arms and body each frame from the pose maths, finding the parts by name
// as the bear's hook does. On a demand canvas it asks for the next frame only while the person
// moves, so a person standing still costs nothing.

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useRef } from "react";
import { type Group } from "three";
import { type Motion } from "./bear-motion";
import { type PersonPose, personPoseAt } from "./person-motion";
import { useFrameOnMotionChange } from "./use-bear-motion";

/** Names of the moving parts, as [right, left] from the person's point of view, like the pose. */
export const PERSON_PART = {
  legs: ["person-leg-right", "person-leg-left"],
  arms: ["person-arm-right", "person-arm-left"],
} as const;

/** Sets only the swing about x: the arms keep the outward tilt the figure gives them. */
export function applyPersonPose(root: Group, pose: PersonPose): void {
  root.position.y = pose.lift;
  root.rotation.x = pose.lean;
  PERSON_PART.legs.forEach((name, index) => {
    const leg = root.getObjectByName(name);
    if (leg !== undefined) leg.rotation.x = pose.legs[index] ?? 0;
  });
  PERSON_PART.arms.forEach((name, index) => {
    const arm = root.getObjectByName(name);
    if (arm !== undefined) arm.rotation.x = pose.arms[index] ?? 0;
  });
}

export function usePersonMotion(motion: Motion): RefObject<Group | null> {
  const root = useRef<Group>(null);
  const invalidate = useThree((state) => state.invalidate);
  useFrameOnMotionChange(motion, invalidate);
  useFrame((state) => {
    if (root.current === null) return;
    applyPersonPose(root.current, personPoseAt(motion, state.clock.getElapsedTime()));
    if (motion !== "still") state.invalidate();
  });
  return root;
}
