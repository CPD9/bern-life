// Doors you can walk up to: one in front of each place's building, on the first side that is not
// built up, and the door of your own office. Standing within reach of a door offers to go in;
// nothing happens until you choose to.

import { type Building } from "./buildings";
import { HOME, PLACE_BUILDING } from "./drawn-city";
import { type MapPoint } from "./geography";

export type Door = {
  /** The building's key for a place; "home" for your office. */
  readonly key: string;
  readonly kind: "place" | "home";
  /** Where you stand to go in. */
  readonly at: MapPoint;
  readonly name: string;
};

export const HOME_DOOR_KEY = "home";
/** In map units from the door: about a house's width. */
export const DOOR_REACH = 1.5;
/** Out from the wall, past the widest walker's shoulders. */
const STEP_OUT = 0.55;
/** The front faces the default camera (south), then east, west and north. */
const SIDES: readonly MapPoint[] = [
  [0, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
];

/** One unit by name, several by the first with a count, so the button stays short. */
export function doorName(building: Building): string {
  const [first, ...others] = building.places;
  const name = first?.name ?? building.key;
  return others.length === 0 ? name : `${name} and ${others.length} more`;
}

export function placeDoor(building: Building, free: (point: MapPoint) => boolean): Door {
  const out = PLACE_BUILDING.size / 2 + STEP_OUT;
  const spots = SIDES.map(([dx, dz]): MapPoint => [building.x + dx * out, building.z + dz * out]);
  return {
    key: building.key,
    kind: "place",
    at: spots.find(free) ?? spots[0] ?? [building.x, building.z],
    name: doorName(building),
  };
}

export function homeDoor([x, z]: MapPoint): Door {
  const front = HOME.depth / 2 - HOME.back;
  return { key: HOME_DOOR_KEY, kind: "home", at: [x, z + front + STEP_OUT], name: "your office" };
}

/** The nearest door within reach of `at`, or null. */
export function doorNear(doors: readonly Door[], [x, z]: MapPoint, reach = DOOR_REACH): Door | null {
  let nearest: Door | null = null;
  let nearestDistance = reach;
  for (const door of doors) {
    const distance = Math.hypot(door.at[0] - x, door.at[1] - z);
    if (distance <= nearestDistance) {
      nearest = door;
      nearestDistance = distance;
    }
  }
  return nearest;
}
