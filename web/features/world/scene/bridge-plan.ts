// Each bridge is one side profile, pushed out to the deck's width: a wall with arched openings down
// to the water, piers between them, and short ramps where it meets the street. A profile is a
// single simple polygon, so it triangulates without holes.

import { type BridgeId, type MapPoint } from "../geography";
import { angleToward, type Footprint } from "./footprint";

export const DECK_HEIGHT = 1.5;
export const BRIDGE_WIDTH = 1.3;
const END_HEIGHT = 0.2;
const RAMP = 1;
const ABUTMENT = 0.8;
const PIER = 0.6;
const CROWN = 0.3;
export const ARCH_RISE = DECK_HEIGHT - CROWN;

export type BridgeProfile = {
  /** Side outline in the bridge's own frame: x along the bridge from 0, y up. */
  readonly outline: readonly MapPoint[];
  /** Centres of the piers between openings, on the same x. */
  readonly piers: readonly number[];
  readonly span: number;
};

export function bridgeProfile(length: number, arches: number, segments: number): BridgeProfile {
  const span = (length - 2 * ABUTMENT - (arches - 1) * PIER) / arches;
  const outline: MapPoint[] = [[0, 0]];
  const piers: number[] = [];
  for (let arch = 0; arch < arches; arch++) {
    const start = ABUTMENT + arch * (span + PIER);
    if (arch > 0) piers.push(start - PIER / 2);
    for (let step = 0; step <= segments; step++) {
      const angle = Math.PI - (Math.PI * step) / segments;
      outline.push([start + span / 2 + (span / 2) * Math.cos(angle), ARCH_RISE * Math.sin(angle)]);
    }
  }
  outline.push(
    [length, 0],
    [length, END_HEIGHT],
    [length - RAMP, DECK_HEIGHT],
    [RAMP, DECK_HEIGHT],
    [0, END_HEIGHT],
  );
  return { outline, piers, span };
}

export type Bridge = {
  readonly id: BridgeId;
  readonly footprint: Footprint;
  readonly profile: BridgeProfile;
};

export function bridgeFootprint([[ax, az], [bx, bz]]: readonly [MapPoint, MapPoint]): Footprint {
  return {
    x: (ax + bx) / 2,
    z: (az + bz) / 2,
    width: Math.hypot(bx - ax, bz - az),
    depth: BRIDGE_WIDTH,
    angle: angleToward(bx - ax, bz - az),
  };
}

export function planBridges(
  bridges: Readonly<Record<BridgeId, readonly [MapPoint, MapPoint]>>,
  arches: Readonly<Record<BridgeId, number>>,
  segments: number,
): Bridge[] {
  return (Object.keys(bridges) as BridgeId[]).sort().map((id) => {
    const footprint = bridgeFootprint(bridges[id]);
    return { id, footprint, profile: bridgeProfile(footprint.width, arches[id], segments) };
  });
}
