// The parts of the city laid out once at load, shared by the scene and its tests: the Aare as a
// smooth curve, the ground landmarks and bridges claim, and the Old Town's houses.

import {
  AARE_PATH,
  AARE_WIDTH,
  BANK_WIDTH,
  BRIDGES,
  DISTRICTS,
  type MapPoint,
  OLD_TOWN_AXIS,
  RATHAUSPLATZ,
  ROAD_WIDTH,
  ROADS,
} from "../geography";
import { PLACES } from "../places";
import { smoothPath } from "../ribbon";
import { bridgeFootprint } from "./bridge-plan";
import { type Footprint } from "./footprint";
import { LANDMARK_BUILDINGS } from "./landmark-plan";
import { planOldTown } from "./old-town-plan";

/** Samples per Aare segment: the curve the town is planned against, and the lite river's. */
export const AARE_SAMPLES = { full: 8, lite: 3 } as const;
export const AARE_CURVE = smoothPath(AARE_PATH, AARE_SAMPLES.full);

/** Houses keep off the water and its banks, with a strip of slope showing between. */
export const RIVER_CLEARANCE = AARE_WIDTH / 2 + BANK_WIDTH + 0.3;
export const STREET_CLEARANCE = ROAD_WIDTH / 2 + 0.15;

export const BRIDGE_FOOTPRINTS: readonly Footprint[] = Object.values(BRIDGES).map(bridgeFootprint);

/** Generic blocks and trees give way to these after the city plan is laid out. */
export const CLAIMED: readonly Footprint[] = [
  ...LANDMARK_BUILDINGS.map((landmark) => landmark.footprint),
  ...BRIDGE_FOOTPRINTS,
];

const OLD_TOWN_OUTLINE = DISTRICTS.find((district) => district.id === "old-town")?.outline ?? [];

export const OLD_TOWN_SITES: readonly MapPoint[] = [
  ...PLACES.map((place): MapPoint => [place.x, place.z]),
  RATHAUSPLATZ,
];

export const OLD_TOWN_STREETS: readonly (readonly MapPoint[])[] = [
  ...ROADS,
  ...Object.values(BRIDGES),
];

/** Wall and roof colours per house; each palette carries this many of each. */
export const HOUSE_TONES = { walls: 3, roofs: 3 } as const;

export const OLD_TOWN_HOUSES = planOldTown({
  outline: OLD_TOWN_OUTLINE,
  axis: OLD_TOWN_AXIS,
  river: AARE_CURVE,
  riverClearance: RIVER_CLEARANCE,
  streets: OLD_TOWN_STREETS,
  streetClearance: STREET_CLEARANCE,
  keepClear: LANDMARK_BUILDINGS.map((landmark) => landmark.footprint),
  sites: OLD_TOWN_SITES,
  tones: HOUSE_TONES,
  /** Bern's founding year. */
  seed: 1191,
});
