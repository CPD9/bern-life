// In walk mode a click on what is drawn says where to walk: a place's building or your office walks
// you to its door, anything else to the spot clicked, on the ground, a roof or a bridge's deck. The
// nearest thing under the pointer takes the click and stops it there, so a click on a building
// never also walks you to the ground hidden behind it. A drag turns the view and walks nowhere.

import { type ThreeEvent } from "@react-three/fiber";
import { type MapPoint } from "../geography";

/** Pixels the pointer may travel between press and release of a click; more is a drag. */
export const CLICK_SLOP = 6;

/** The map point of a click, or null for a drag. */
export function pickedPoint(
  event: Pick<ThreeEvent<MouseEvent>, "delta" | "point">,
): MapPoint | null {
  return event.delta > CLICK_SLOP ? null : [event.point.x, event.point.z];
}

export type WalkClick = Pick<ThreeEvent<MouseEvent>, "delta" | "point" | "stopPropagation">;

/** Where a click on one thing walks you; absent outside walk mode. */
export type OnWalkClick = ((point: MapPoint) => void) | undefined;

/**
 * The click handler for one drawn thing, spread onto its mesh; none outside walk mode, so nothing
 * is hit-tested then. Only meshes carry one, never a group around them, so a click is handled once.
 */
export function walkClick(onWalk: OnWalkClick): {
  onClick?: (event: WalkClick) => void;
} {
  if (onWalk === undefined) return {};
  return {
    onClick: (event) => {
      event.stopPropagation();
      const point = pickedPoint(event);
      if (point !== null) onWalk(point);
    },
  };
}
