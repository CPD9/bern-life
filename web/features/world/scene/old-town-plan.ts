// The Old Town as Bern draws it: long rows of narrow houses running east-west, parallel to the
// main street, in back-to-back pairs between lanes. Rows follow the axis, so they bend with it.
// A house is left out where it would stand in the river or its banks, on a street or a bridge, on
// a landmark's square or a place site, or outside the Old Town. Seeded: the same town every load.

import { CLEARANCE } from "../city-plan";
import { type MapPoint } from "../geography";
import { distanceToPolyline, pointInPolygon } from "../geometry";
import { seededRandom } from "../random";
import { angleToward, corners, type Footprint, overlaps } from "./footprint";

export type House = Footprint & {
  readonly height: number;
  readonly wall: number;
  readonly roof: number;
};

export type OldTownInput = {
  readonly outline: readonly MapPoint[];
  readonly axis: readonly MapPoint[];
  readonly river: readonly MapPoint[];
  /** From the river's centre line to any corner of a house. */
  readonly riverClearance: number;
  readonly streets: readonly (readonly MapPoint[])[];
  /** From a street's centre line to any corner of a house. */
  readonly streetClearance: number;
  readonly keepClear: readonly Footprint[];
  readonly sites: readonly MapPoint[];
  readonly tones: { readonly walls: number; readonly roofs: number };
  readonly seed: number;
};

export const HOUSE_DEPTH = 1.4;
/** Around a landmark: its square. */
const SQUARE_MARGIN = 0.8;
const ALLEY = 0.8;
const PARTY_WALL_GAP = 0.04;

/** Back-to-back pairs of rows either side of the axis, a lane between pairs. Positive is south. */
export const ROW_OFFSETS: readonly number[] = [0, 1, 2, 3, 4].flatMap((pair) => {
  const near = 1.7 + pair * 3.9;
  const far = near + 1.6;
  return [-far, -near, near, far];
});

type Station = { point: MapPoint; tangent: MapPoint };

function walker(axis: readonly MapPoint[]): { length: number; at: (s: number) => Station } {
  const segments = axis.slice(1).map((end, index) => {
    const start = axis[index] ?? end;
    return { start, end, length: Math.hypot(end[0] - start[0], end[1] - start[1]) };
  });
  const length = segments.reduce((sum, segment) => sum + segment.length, 0);
  return {
    length,
    at(s) {
      let remaining = s;
      for (const segment of segments) {
        if (remaining <= segment.length || segment === segments.at(-1)) {
          const [sx, sz] = segment.start;
          const tx = (segment.end[0] - sx) / segment.length;
          const tz = (segment.end[1] - sz) / segment.length;
          return { point: [sx + tx * remaining, sz + tz * remaining], tangent: [tx, tz] };
        }
        remaining -= segment.length;
      }
      return { point: [0, 0], tangent: [1, 0] };
    },
  };
}

function fits(house: Footprint, input: OldTownInput): boolean {
  const centre: MapPoint = [house.x, house.z];
  if (!pointInPolygon(centre, input.outline)) return false;
  const points = [centre, ...corners(house)];
  if (points.some((point) => distanceToPolyline(point, input.river) < input.riverClearance)) {
    return false;
  }
  const onStreet = input.streets.some((street) =>
    points.some((point) => distanceToPolyline(point, street) < input.streetClearance),
  );
  if (onStreet) return false;
  if (input.keepClear.some((square) => overlaps(square, house, SQUARE_MARGIN))) return false;
  return input.sites.every(([x, z]) => Math.hypot(house.x - x, house.z - z) >= CLEARANCE.site);
}

/** Where the axis bends, a row's houses fan out on one side and crowd on the other; the crowded
 * ones are left out. */
function crowds(house: Footprint, placed: readonly Footprint[]): boolean {
  return placed.some(
    (other) =>
      Math.hypot(house.x - other.x, house.z - other.z) < HOUSE_DEPTH + 1 && overlaps(other, house),
  );
}

export function planOldTown(input: OldTownInput): House[] {
  const random = seededRandom(input.seed);
  const axis = walker(input.axis);
  const houses: House[] = [];
  for (const offset of ROW_OFFSETS) {
    let s = 0;
    while (s < axis.length) {
      const width = 0.75 + random() * 0.4;
      const height = 1.1 + random() * 0.5;
      const wall = Math.floor(random() * input.tones.walls);
      const roof = Math.floor(random() * input.tones.roofs);
      const alley = random() < 0.1;
      const { point, tangent } = axis.at(s + width / 2);
      const house: House = {
        x: point[0] - tangent[1] * offset,
        z: point[1] + tangent[0] * offset,
        width: width - PARTY_WALL_GAP,
        depth: HOUSE_DEPTH,
        angle: angleToward(tangent[0], tangent[1]),
        height,
        wall,
        roof,
      };
      if (fits(house, input) && !crowds(house, houses)) houses.push(house);
      s += width + (alley ? ALLEY : 0);
    }
  }
  return houses;
}
