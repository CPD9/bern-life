// The map's one layout, worked out once at load: the places grouped into buildings, and the seeded
// city around them, which keeps clear of every place and of the square in front of the city hall.

import { groupPlacesByBuilding } from "./buildings";
import { planCity } from "./city-plan";
import { AARE_PATH, DISTRICTS, MAP_BOUNDS, RATHAUSPLATZ, ROADS } from "./geography";
import { PLACES } from "./places";

export const BUILDINGS = groupPlacesByBuilding(PLACES);

export const CITY = planCity({
  districts: DISTRICTS,
  river: AARE_PATH,
  roads: ROADS,
  sites: [...BUILDINGS.map((building): [number, number] => [building.x, building.z]), RATHAUSPLATZ],
  bounds: MAP_BOUNDS,
  seed: 1291,
});
