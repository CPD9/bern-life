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
