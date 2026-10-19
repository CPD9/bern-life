import { describe, expect, test } from "bun:test";
import { PLOTS } from "@/features/settle/plots";
import { groupPlacesByBuilding } from "@/features/world/buildings";
import { planCity } from "@/features/world/city-plan";
import {
  AARE_PATH,
  DISTRICTS,
  MAP_BOUNDS,
  type MapPoint,
  RATHAUSPLATZ,
  ROADS,
} from "@/features/world/geography";
import { doorNear } from "@/features/world/doors";
import { PLACES } from "@/features/world/places";
import { WALKER_RADIUS } from "@/features/world/walk";
import { buildGrid } from "@/features/world/walk-grid";
import { blocked } from "@/features/world/walk-map";
import { findPath } from "@/features/world/walk-path";
import { walkWorld } from "@/features/world/walk-world";

// The settle plots and the map are two features; here they meet: wherever you settle, you can
// leave your office, walk up to every place's door close enough to go in, and walk home again.

const buildings = groupPlacesByBuilding(PLACES);
const plan = planCity({
  districts: DISTRICTS,
  river: AARE_PATH,
  roads: ROADS,
  sites: [...buildings.map((b): MapPoint => [b.x, b.z]), RATHAUSPLATZ],
  bounds: MAP_BOUNDS,
  seed: 1291,
});
const homes: (MapPoint | null)[] = [null, ...PLOTS.map((plot): MapPoint => [plot.x, plot.z])];

describe("walking Bern from every plot", () => {
  test.each(homes.map((home) => [home]))("from %p every door can be walked up to", (home) => {
    const world = walkWorld(plan, buildings, home);
    expect(blocked(world.map, world.start, WALKER_RADIUS)).toBe(false);
    const grid = buildGrid((at) => !blocked(world.map, at, WALKER_RADIUS), MAP_BOUNDS, 0.5);
    const unreached = world.doors.filter((door) => {
      const end = findPath(grid, world.start, door.at)?.at(-1);
      return end === undefined || doorNear(world.doors, end)?.key !== door.key;
    });
    expect(unreached.map((door) => door.key)).toEqual([]);
  });
});
