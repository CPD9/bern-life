// The way a click-to-walk will take, dotted on the ground with a ring where it ends. It is drawn
// once per path, not per frame, and goes when the walk ends or Escape cancels it.

import { Line } from "@react-three/drei";
import { useMemo } from "react";
import { type MapPoint } from "../geography";
import { groundHeight, type WalkMap } from "../walk-map";

/** Lumi's gold, which reads on the day and the night ground alike. */
const COLOUR = "#e0a526";
const LIFT = 0.15;

export function PathPreview({ points, map }: { points: readonly MapPoint[]; map: WalkMap }) {
  const line = useMemo(
    () =>
      points.map((point): [number, number, number] => [
        point[0],
        groundHeight(map, point) + LIFT,
        point[1],
      ]),
    [points, map],
  );
  const end = line[line.length - 1];
  if (end === undefined) return null;
  return (
    <group>
      <Line points={line} color={COLOUR} lineWidth={3} dashed dashSize={0.5} gapSize={0.35} />
      <mesh position={end} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.35, 0.55, 24]} />
        <meshBasicMaterial color={COLOUR} />
      </mesh>
    </group>
  );
}
