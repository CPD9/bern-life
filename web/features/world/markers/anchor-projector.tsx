// Runs on every rendered frame (only when something moves, in demand mode) and writes each anchored
// element's screen position directly, so moving the camera never re-renders React.

import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { type Anchor, type AnchorElements } from "./anchors";

const projected = new Vector3();
const MARGIN = 1.1;

export function AnchorProjector({
  anchors,
  elementsRef,
}: {
  anchors: readonly Anchor[];
  elementsRef: AnchorElements;
}) {
  useFrame(({ camera, size }) => {
    for (const anchor of anchors) {
      const element = elementsRef.current.get(anchor.key);
      if (element === undefined) continue;
      projected.set(...anchor.position).project(camera);
      const onScreen =
        projected.z < 1 && Math.abs(projected.x) <= MARGIN && Math.abs(projected.y) <= MARGIN;
      const left = ((projected.x + 1) / 2) * size.width;
      const top = ((1 - projected.y) / 2) * size.height;
      element.style.transform = `translate(${left}px, ${top}px) translate(-50%, -50%)`;
      element.style.zIndex = String(Math.round((1 - projected.z) * 10_000));
      element.style.visibility = onScreen ? "visible" : "hidden";
    }
  });
  return null;
}
