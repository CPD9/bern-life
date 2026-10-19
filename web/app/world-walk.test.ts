import { describe, expect, test } from "bun:test";
import { PLOTS } from "@/features/settle/plots";
import { BUILDINGS, CITY } from "@/features/world/city-layout";
import { doorNear, HOME_DOOR_KEY } from "@/features/world/doors";
import { BRIDGES, type MapPoint } from "@/features/world/geography";
import { bridgeFootprint } from "@/features/world/scene/bridge-plan";
import { WALKER_RADIUS } from "@/features/world/walk";
import { blocked, type WalkMap } from "@/features/world/walk-map";
import { findPath, type Planner, walkPlanner } from "@/features/world/walk-path";
import { advance, arrive, withPath } from "@/features/world/walk-session";
import { walkWorld } from "@/features/world/walk-world";

// The settle plots and the map are two features; here they meet: wherever you settle, you can
// leave your office, walk up to every place's door close enough to go in, cross every bridge, and
// walk home again. Each walk is played out frame by frame as the map plays it, so a path the
// walker cannot follow to its end fails here, not only a path the planner cannot find.

const homes: (MapPoint | null)[] = [null, ...PLOTS.map((plot): MapPoint => [plot.x, plot.z])];
const middles = Object.entries(BRIDGES).map(([name, ends]) => {
  const deck = bridgeFootprint(ends);
  return { name: `bridge ${name}`, at: [deck.x, deck.z] as MapPoint };
});
/** Two minutes at 60 frames a second: longer than any walk across the map. */
const FRAMES = 60 * 120;
const STANDING = { held: new Set<string>(), azimuth: 0, seconds: 1 / 60, snapTurn: false };

/** Where you stand once the click-to-walk path from `from` to `to` has been walked out. */
function walkOut(map: WalkMap, planner: Planner, from: MapPoint, to: MapPoint): MapPoint | null {
  const path = findPath(planner, from, to);
  if (path === null) return null;
  let session = withPath(arrive(map, from), path);
  for (let frame = 0; frame < FRAMES && session.walker.path.length > 0; frame++) {
    session = advance(map, session, STANDING).session;
  }
  return session.walker.at;
}

describe("walking Bern from every plot", () => {
  test.each(homes.map((home) => [home]))(
    "from %p every door and every bridge is walked to, and home again",
    (home) => {
      const world = walkWorld(CITY, BUILDINGS, home);
      expect(blocked(world.map, world.start, WALKER_RADIUS)).toBe(false);
      const planner = walkPlanner(world.map);
      const reaches = (from: MapPoint, to: MapPoint, door: string) => {
        const end = walkOut(world.map, planner, from, to);
        return end !== null && doorNear(world.doors, end)?.key === door;
      };
      const missed = world.doors
        .filter((door) => !reaches(world.start, door.at, door.key))
        .map((door) => door.key);
      for (const middle of middles) {
        const end = walkOut(world.map, planner, world.start, middle.at);
        if (end === null || Math.hypot(end[0] - middle.at[0], end[1] - middle.at[1]) > 1e-3) {
          missed.push(middle.name);
        }
      }
      if (home !== null) {
        for (const door of world.doors.filter((place) => place.kind === "place")) {
          if (!reaches(door.at, world.start, HOME_DOOR_KEY)) missed.push(`home from ${door.key}`);
        }
      }
      expect(missed).toEqual([]);
    },
  );
});
