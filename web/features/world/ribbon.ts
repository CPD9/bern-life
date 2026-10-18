// A flat band along a centre line, for the Aare and the roads. Each vertex pair is offset along
// the normal of the averaged tangent; bends narrow slightly, which reads fine at map scale.

import { type MapPoint } from "./geography";

export type Ribbon = { positions: Float32Array; indices: Uint16Array };

function unitTangent(path: readonly MapPoint[], index: number): MapPoint {
  const [px, pz] = path[Math.max(0, index - 1)] ?? [0, 0];
  const [nx, nz] = path[Math.min(path.length - 1, index + 1)] ?? [0, 0];
  const length = Math.hypot(nx - px, nz - pz) || 1;
  return [(nx - px) / length, (nz - pz) / length];
}

export function ribbon(path: readonly MapPoint[], width: number, height: number): Ribbon {
  const half = width / 2;
  const positions = new Float32Array(path.length * 6);
  path.forEach(([x, z], index) => {
    const [tx, tz] = unitTangent(path, index);
    positions.set(
      [x - tz * half, height, z + tx * half, x + tz * half, height, z - tx * half],
      index * 6,
    );
  });
  const indices = new Uint16Array(Math.max(0, path.length - 1) * 6);
  for (let i = 0; i < path.length - 1; i++) {
    const a = i * 2;
    indices.set([a, a + 2, a + 1, a + 1, a + 2, a + 3], i * 6);
  }
  return { positions, indices };
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (3 * p1 - p0 - 3 * p2 + p3) * t2 * t)
  );
}

/** Catmull-Rom through every point of `path`, `samples` steps per segment, so the Aare bends
 * instead of kinking. The curve passes through each given point; the ends repeat theirs. */
export function smoothPath(path: readonly MapPoint[], samples: number): MapPoint[] {
  if (path.length < 3 || samples < 2) return [...path];
  const at = (index: number): MapPoint =>
    path[Math.max(0, Math.min(path.length - 1, index))] ?? [0, 0];
  const points: MapPoint[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let step = 0; step < samples; step++) {
      const t = step / samples;
      points.push([
        catmullRom(p0[0], p1[0], p2[0], p3[0], t),
        catmullRom(p0[1], p1[1], p2[1], p3[1], t),
      ]);
    }
  }
  points.push(at(path.length - 1));
  return points;
}
