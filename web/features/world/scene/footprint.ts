// Turned rectangles on the ground: what a landmark, a bridge or an Old Town house covers. The angle
// follows three.js rotation about y, so a footprint and its mesh share one number.

import { type MapPoint } from "../geography";

export type Footprint = {
  readonly x: number;
  readonly z: number;
  /** Along the local x axis, before turning. */
  readonly width: number;
  readonly depth: number;
  readonly angle: number;
};

/** The rotation about y that turns local +x toward (dx, dz). */
export function angleToward(dx: number, dz: number): number {
  return -Math.atan2(dz, dx);
}

export function toWorld(footprint: Footprint, [lx, lz]: MapPoint): MapPoint {
  const cos = Math.cos(footprint.angle);
  const sin = Math.sin(footprint.angle);
  return [footprint.x + lx * cos + lz * sin, footprint.z - lx * sin + lz * cos];
}

export function corners(footprint: Footprint): MapPoint[] {
  const w = footprint.width / 2;
  const d = footprint.depth / 2;
  return (
    [
      [-w, -d],
      [w, -d],
      [w, d],
      [-w, d],
    ] as const
  ).map((corner) => toWorld(footprint, corner));
}

/** True when `point` lies within `margin` of the rectangle (a square-cornered grown box). */
export function covers(footprint: Footprint, [px, pz]: MapPoint, margin = 0): boolean {
  const dx = px - footprint.x;
  const dz = pz - footprint.z;
  const cos = Math.cos(footprint.angle);
  const sin = Math.sin(footprint.angle);
  const lx = dx * cos - dz * sin;
  const lz = dx * sin + dz * cos;
  return (
    Math.abs(lx) <= footprint.width / 2 + margin && Math.abs(lz) <= footprint.depth / 2 + margin
  );
}

export function coveredByAny(
  footprints: readonly Footprint[],
  point: MapPoint,
  margin: number,
): boolean {
  return footprints.some((footprint) => covers(footprint, point, margin));
}

function axes(footprint: Footprint): MapPoint[] {
  const cos = Math.cos(footprint.angle);
  const sin = Math.sin(footprint.angle);
  return [
    [cos, -sin],
    [sin, cos],
  ];
}

/** Separating axis test, with `margin` added around `a`. */
export function overlaps(a: Footprint, b: Footprint, margin = 0): boolean {
  const grown = { ...a, width: a.width + 2 * margin, depth: a.depth + 2 * margin };
  const pointsA = corners(grown);
  const pointsB = corners(b);
  return [...axes(grown), ...axes(b)].every(([ax, az]) => {
    const project = (points: MapPoint[]) => points.map(([x, z]) => x * ax + z * az);
    const onA = project(pointsA);
    const onB = project(pointsB);
    return Math.max(...onA) >= Math.min(...onB) && Math.max(...onB) >= Math.min(...onA);
  });
}
