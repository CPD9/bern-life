import { type MapPoint } from "./geography";

/** Even-odd ray casting; a point on an edge may land either way, which a city layout tolerates. */
export function pointInPolygon([x, z]: MapPoint, polygon: readonly MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i] ?? [0, 0];
    const [xj, zj] = polygon[j] ?? [0, 0];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function distanceToSegment([px, pz]: MapPoint, [ax, az]: MapPoint, [bx, bz]: MapPoint): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSquared = dx * dx + dz * dz;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export function distanceToPolyline(point: MapPoint, path: readonly MapPoint[]): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    if (a !== undefined && b !== undefined) {
      nearest = Math.min(nearest, distanceToSegment(point, a, b));
    }
  }
  return nearest;
}

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export function polygonBounds(polygon: readonly MapPoint[]): Bounds {
  const xs = polygon.map(([x]) => x);
  const zs = polygon.map(([, z]) => z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}
