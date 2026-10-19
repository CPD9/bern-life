// Your agent walks a little behind you, on the way you came, so it goes round every wall you went
// round. Standing, it waits beside you. The trail is plain points, newest first, kept short.

import { type MapPoint } from "./geography";
import { blocked, type WalkMap } from "./walk-map";

/** Newest first. */
export type Trail = readonly MapPoint[];

/** How far behind you the agent walks, along the trail. */
export const FOLLOW_GAP = 1.4;
const SPACING = 0.2;
const KEEP = FOLLOW_GAP + 1;
const BESIDE = 1.1;

function length(trail: Trail): number {
  let total = 0;
  for (let index = 1; index < trail.length; index++) {
    const [ax, az] = trail[index - 1] ?? [0, 0];
    const [bx, bz] = trail[index] ?? [0, 0];
    total += Math.hypot(bx - ax, bz - az);
  }
  return total;
}

/** Adds where you stand now when you have moved far enough, and drops what lies beyond use. */
export function extendTrail(trail: Trail, at: MapPoint): Trail {
  const newest = trail[0];
  if (newest !== undefined && Math.hypot(at[0] - newest[0], at[1] - newest[1]) < SPACING) {
    return trail;
  }
  const grown = [at, ...trail];
  while (grown.length > 2 && length(grown.slice(0, -1)) >= KEEP) grown.pop();
  return grown;
}

/** The point `distance` along the trail from its newest end, or its oldest point if shorter. */
export function pointBehind(trail: Trail, distance: number): MapPoint | null {
  let left = distance;
  for (let index = 1; index < trail.length; index++) {
    const [ax, az] = trail[index - 1] ?? [0, 0];
    const [bx, bz] = trail[index] ?? [0, 0];
    const step = Math.hypot(bx - ax, bz - az);
    if (step >= left && step > 0) {
      const t = left / step;
      return [ax + (bx - ax) * t, az + (bz - az) * t];
    }
    left -= step;
  }
  return trail[trail.length - 1] ?? null;
}

/**
 * Where the agent stands beside you when you arrive somewhere: at your right, else your left, else
 * behind you, whichever is clear; your own spot when none is.
 */
export function besideSpot(map: WalkMap, at: MapPoint, heading: number, radius: number): MapPoint {
  const right: MapPoint = [-Math.cos(heading), Math.sin(heading)];
  const behind: MapPoint = [-Math.sin(heading), -Math.cos(heading)];
  const spots = [right, [-right[0], -right[1]] as const, behind].map(([dx, dz]): MapPoint => [
    at[0] + dx * BESIDE,
    at[1] + dz * BESIDE,
  ]);
  return spots.find((spot) => !blocked(map, spot, radius)) ?? at;
}

/** A fresh trail that leaves the agent standing at `beside` until you move off. */
export function startTrail(at: MapPoint, beside: MapPoint): Trail {
  return [at, beside];
}
