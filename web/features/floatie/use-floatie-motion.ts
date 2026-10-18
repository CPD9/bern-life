// Moves Lumi's parts each frame from the pose maths. Parts are found by name, so no refs travel
// through props. The canvas renders on demand: Lumi asks for the next frame only while it moves,
// and under reduced motion it draws its resting pose once per state change.

import { useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useRef } from "react";
import {
  type Group,
  Material,
  MeshLambertMaterial,
  MeshStandardMaterial,
  type Object3D,
  PointLight,
} from "three";
import { type FloatiePose, type FloatieState, poseAt } from "./floatie-motion";

/** Names of the moving parts; the figure's parts carry them as their `name`. */
export const PART = {
  body: "floatie-body",
  core: "floatie-core",
  halo: "floatie-halo",
  light: "floatie-light",
  ripple: "floatie-ripple",
  wings: ["floatie-wing-left", "floatie-wing-right"],
  eyes: ["floatie-eye-left", "floatie-eye-right"],
} as const;

const LIGHT_INTENSITY = 0.6;
const CORE_EMBER = 0.45;

function materialOf(part: Object3D | undefined): Material | undefined {
  const material: unknown = part && "material" in part ? part.material : undefined;
  return material instanceof Material ? material : undefined;
}

function applyPose(root: Group, pose: FloatiePose) {
  const part = (name: string): Object3D | undefined => root.getObjectByName(name);
  root.position.y = pose.lift;
  part(PART.body)?.rotation.set(pose.lean, 0, 0);
  PART.wings.forEach((name, index) =>
    part(name)?.rotation.set(0, (index === 0 ? -1 : 1) * pose.wings, 0),
  );
  PART.eyes.forEach((name) => part(name)?.scale.set(1, pose.eyes, 1));
  part(PART.halo)?.scale.setScalar(pose.halo);

  const core = materialOf(part(PART.core));
  if (core instanceof MeshStandardMaterial || core instanceof MeshLambertMaterial) {
    core.emissiveIntensity = CORE_EMBER * pose.glow;
  }
  const light = part(PART.light);
  if (light instanceof PointLight) light.intensity = LIGHT_INTENSITY * pose.glow;

  const ripple = part(PART.ripple);
  ripple?.scale.setScalar(pose.ripple.scale);
  const rippleMaterial = materialOf(ripple);
  if (rippleMaterial) rippleMaterial.opacity = pose.ripple.opacity;
  if (ripple) ripple.visible = pose.ripple.opacity > 0;
}

export function useFloatieMotion(
  state: FloatieState,
  reducedMotion: boolean,
): RefObject<Group | null> {
  const root = useRef<Group>(null);
  const invalidate = useThree((three) => three.invalidate);

  // A change of state or setting needs one fresh frame even when nothing keeps moving.
  useEffect(() => invalidate(), [state, reducedMotion, invalidate]);

  useFrame((three) => {
    if (root.current === null) return;
    applyPose(root.current, poseAt(state, three.clock.getElapsedTime(), reducedMotion));
    if (!reducedMotion) three.invalidate();
  });
  return root;
}
