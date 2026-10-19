import { describe, expect, test } from "bun:test";
import { PLOTS } from "@/features/settle/plots";
import { BUILDINGS, CITY } from "@/features/world/city-layout";
import { doorNear } from "@/features/world/doors";
import { BRIDGES, MAP_BOUNDS, type MapPoint } from "@/features/world/geography";
import { bridgeFootprint } from "@/features/world/scene/bridge-plan";
import { WALKER_RADIUS } from "@/features/world/walk";
import { buildGrid } from "@/features/world/walk-grid";
import { blocked } from "@/features/world/walk-map";
import { findPath } from "@/features/world/walk-path";
import { walkWorld } from "@/features/world/walk-world";

// The settle plots and the map are two features; here they meet: wherever you settle, you can
// leave your office, walk up to every place's door close enough to go in, cross every bridge, and
// walk home again.

const homes: (MapPoint | null)[] = [null, ...PLOTS.map((plot): MapPoint => [plot.x, plot.z])];

describe("walking Bern from every plot", () => {
  test.each(homes.map((home) => [home]))(
    "from %p every door and every bridge can be walked to",
    (home) => {
      const world = walkWorld(CITY, BUILDINGS, home);
      expect(blocked(world.map, world.start, WALKER_RADIUS)).toBe(false);
      const grid = buildGrid((at) => !blocked(world.map, at, WALKER_RADIUS), MAP_BOUNDS, 0.5);
      const unreached = world.doors.filter((door) => {
        const end = findPath(grid, world.start, door.at)?.at(-1);
        return end === undefined || doorNear(world.doors, end)?.key !== door.key;
      });
      expect(unreached.map((door) => door.key)).toEqual([]);
      const middles = Object.values(BRIDGES).map((ends): MapPoint => {
        const deck = bridgeFootprint(ends);
        return [deck.x, deck.z];
      });
      expect(middles.map((middle) => findPath(grid, world.start, middle)?.at(-1))).toEqual(middles);
    },
  );
});
