// Camera moves as plain numbers. Keyboard moves the map in steps: arrows and WASD pan along the
// ground relative to the view, Q and E turn by 45°, + and - zoom. Panning follows the camera's
// azimuth so "up" always moves away from the viewer, whichever way the map is turned.

import { type MapPoint } from "./geography";

export type CameraCommand =
  | { readonly kind: "pan"; readonly right: number; readonly forward: number }
  | { readonly kind: "rotate"; readonly steps: number }
  | { readonly kind: "zoom"; readonly steps: number };

const COMMANDS: Readonly<Record<string, CameraCommand>> = {
  ArrowUp: { kind: "pan", right: 0, forward: 1 },
  w: { kind: "pan", right: 0, forward: 1 },
  ArrowDown: { kind: "pan", right: 0, forward: -1 },
  s: { kind: "pan", right: 0, forward: -1 },
  ArrowLeft: { kind: "pan", right: -1, forward: 0 },
  a: { kind: "pan", right: -1, forward: 0 },
  ArrowRight: { kind: "pan", right: 1, forward: 0 },
  d: { kind: "pan", right: 1, forward: 0 },
  q: { kind: "rotate", steps: -1 },
  e: { kind: "rotate", steps: 1 },
  "+": { kind: "zoom", steps: 1 },
  "=": { kind: "zoom", steps: 1 },
  "-": { kind: "zoom", steps: -1 },
};

export function commandForKey(key: string): CameraCommand | null {
  return COMMANDS[key.length === 1 ? key.toLowerCase() : key] ?? null;
}

export const PAN_STEP = 8;
export const ROTATE_STEP = Math.PI / 4;
export const ZOOM_STEP = 18;

/**
 * Ground offset for a pan. camera-controls puts the camera at azimuth θ on the (sin θ, cos θ)
 * side of its target, so forward is the opposite direction and right is (cos θ, -sin θ).
 */
export function panOffset(azimuth: number, right: number, forward: number): MapPoint {
  const sin = Math.sin(azimuth);
  const cos = Math.cos(azimuth);
  return [(right * cos - forward * sin) * PAN_STEP, (-right * sin - forward * cos) * PAN_STEP];
}

export const START_VIEW = {
  target: [-40, 0, -10],
  distance: 175,
  polar: 0.85,
  azimuth: -0.35,
} as const;

export const MAX_DISTANCE = 300;

/** A portrait screen sees less of the map sideways, so the start view pulls back, up to a limit. */
export function startPosition(aspect: number): [number, number, number] {
  const { polar, azimuth } = START_VIEW;
  const distance = START_VIEW.distance * Math.min(1.7, Math.max(1, 1.1 / aspect));
  const [tx, , tz] = START_VIEW.target;
  return [
    tx + distance * Math.sin(polar) * Math.sin(azimuth),
    distance * Math.cos(polar),
    tz + distance * Math.sin(polar) * Math.cos(azimuth),
  ];
}
