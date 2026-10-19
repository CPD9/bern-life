// Walking as plain numbers, so every step can be checked without three.js. Kinematic, no physics:
// a step that would end in a wall or the river is tried again along x and along z alone, so you
// slide along a facade instead of stopping dead. Long steps are cut into short ones, so a slow
// frame never carries you through a thin wall.

import { panOffset } from "./camera-moves";
import { type MapPoint } from "./geography";
import { blocked, type WalkMap } from "./walk-map";

/**
 * Map units a second. One unit is about 20 m, so this is 120 m/s: at a real walking pace of
 * 1.4 m/s one street would take minutes, so the city's time runs about 85 times faster.
 */
export const WALK_SPEED = 6;
/** Half the figure's shoulders on the map, narrow enough for the Old Town's lanes. */
export const WALKER_RADIUS = 0.3;
/** Radians a second: a full about-turn in a quarter of a second. */
const TURN_SPEED = 12;
const ARRIVED = 1e-6;

export type Walker = {
  readonly at: MapPoint;
  /** Rotation about y for a figure facing +z: it faces (sin heading, cos heading). */
  readonly heading: number;
  /** Points still to walk through, the next first; empty when standing or steered by keys. */
  readonly path: readonly MapPoint[];
};

export function slide(map: WalkMap, from: MapPoint, to: MapPoint, radius: number): MapPoint {
  if (!blocked(map, to, radius)) return to;
  const alongX: MapPoint = [to[0], from[1]];
  const alongZ: MapPoint = [from[0], to[1]];
  // The longer part of the step first, so a glancing hit keeps most of the motion.
  const tries =
    Math.abs(to[0] - from[0]) >= Math.abs(to[1] - from[1]) ? [alongX, alongZ] : [alongZ, alongX];
  return tries.find((point) => !blocked(map, point, radius)) ?? from;
}

export function move(map: WalkMap, from: MapPoint, [dx, dz]: MapPoint, radius: number): MapPoint {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (radius / 2)));
  let at = from;
  for (let step = 0; step < steps; step++) {
    at = slide(map, at, [at[0] + dx / steps, at[1] + dz / steps], radius);
  }
  return at;
}

/** A unit direction on the ground from held keys, relative to the camera as the map's panning is. */
export function keyDirection(azimuth: number, right: number, forward: number): MapPoint {
  const [x, z] = panOffset(azimuth, right, forward);
  const length = Math.hypot(x, z);
  return length === 0 ? [0, 0] : [x / length, z / length];
}

export function headingToward(dx: number, dz: number): number {
  return Math.atan2(dx, dz);
}

/** Turns from `heading` toward `target` the short way round, by at most `maxStep`. */
export function turn(heading: number, target: number, maxStep: number): number {
  const difference = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
  if (Math.abs(difference) <= maxStep) return target;
  return heading + Math.sign(difference) * maxStep;
}

export type WalkInput = {
  /** From held keys; [0, 0] when none is held, and the path is followed instead. */
  readonly direction: MapPoint;
  readonly seconds: number;
  /** Reduced motion: face the new way at once instead of turning toward it. */
  readonly snapTurn: boolean;
};

function turned(walker: Walker, [dx, dz]: MapPoint, input: WalkInput): number {
  if (dx === 0 && dz === 0) return walker.heading;
  const target = headingToward(dx, dz);
  return input.snapTurn ? target : turn(walker.heading, target, TURN_SPEED * input.seconds);
}

/** One frame of walking: keys steer and drop any path; otherwise the walker heads for the next point. */
export function walkTick(map: WalkMap, walker: Walker, input: WalkInput): Walker {
  const reach = WALK_SPEED * input.seconds;
  const [kx, kz] = input.direction;
  if (kx !== 0 || kz !== 0) {
    const at = move(map, walker.at, [kx * reach, kz * reach], WALKER_RADIUS);
    return { at, heading: turned(walker, input.direction, input), path: [] };
  }
  const [next, ...rest] = walker.path;
  if (next === undefined) return walker;
  const delta: MapPoint = [next[0] - walker.at[0], next[1] - walker.at[1]];
  const before = Math.hypot(...delta);
  const share = Math.min(1, reach / Math.max(before, ARRIVED));
  const at = move(map, walker.at, [delta[0] * share, delta[1] * share], WALKER_RADIUS);
  const left = Math.hypot(next[0] - at[0], next[1] - at[1]);
  const arrived = left <= ARRIVED;
  // Sliding still closes in on the point; a step that gets no closer has met a wall it cannot pass.
  const stuck = !arrived && left >= before - ARRIVED;
  return {
    at,
    heading: turned(walker, delta, input),
    path: arrived ? rest : stuck ? [] : walker.path,
  };
}
