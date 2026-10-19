// Where the bear's parts sit, in metres with the feet on y = 0 and the face towards +z. Shared by
// the body, head, outfit and accessories so they stay in step when proportions change.

export const BODY = { radius: 0.3, y: 0.38, scale: [1, 0.95, 0.88] } as const;
export const HEAD = { radius: 0.36, y: 0.92 } as const;
export const NECK_Y = 0.66;
/** A soft fill between head and body, so the two read as one rounded shape without a crease. */
export const NECK = { radius: 0.2, scale: [1.05, 0.6, 0.92] } as const;

/** How far a point at (x, y) on the head sits in front of its centre, so features rest on it. */
export function headSurfaceZ(x: number, y: number): number {
  const r = HEAD.radius;
  return Math.sqrt(Math.max(0, r * r - x * x - y * y));
}
