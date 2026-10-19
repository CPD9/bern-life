// The walkable city for one home, worked out once per home: what is drawn, the walk map built from
// exactly that, every door, and where you arrive. Before you settle you arrive at the station and
// there is no office door to go home through.

import { type Building } from "./buildings";
import { type CityPlan } from "./city-plan";
import { cityWalkMap, type DrawnCity, drawnCity } from "./drawn-city";
import { type Door, homeDoor, placeDoor } from "./doors";
import { BAHNHOFPLATZ, type MapPoint } from "./geography";
import { WALKER_RADIUS } from "./walk";
import { blocked, type WalkMap } from "./walk-map";

export type WalkWorld = {
  readonly drawn: DrawnCity;
  readonly map: WalkMap;
  readonly doors: readonly Door[];
  readonly start: MapPoint;
};

export function walkWorld(
  plan: CityPlan,
  buildings: readonly Building[],
  home: MapPoint | null,
): WalkWorld {
  const drawn = drawnCity(plan, home);
  const map = cityWalkMap(drawn, buildings, home);
  const free = (point: MapPoint) => !blocked(map, point, WALKER_RADIUS);
  const places = buildings.map((building) => placeDoor(building, free));
  const office = home === null ? null : homeDoor(home);
  return {
    drawn,
    map,
    doors: office === null ? places : [...places, office],
    start: office?.at ?? BAHNHOFPLATZ,
  };
}
