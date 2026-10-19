import { describe, expect, test } from "bun:test";
import { BUILDINGS, CITY as PLAN } from "./city-layout";
import { cityObstacles, cityWalkMap, drawnCity, homeLot, homeOffice } from "./drawn-city";
import { homeDoor } from "./doors";
import { BRIDGES, type MapPoint } from "./geography";
import { bridgeFootprint } from "./scene/bridge-plan";
import { covers, overlaps } from "./scene/footprint";
import { AARE_CURVE, OLD_TOWN_HOUSES } from "./scene/town";
import { WALKER_RADIUS } from "./walk";
import { blocked, groundHeight } from "./walk-map";

/** An Old Town plot, among the house rows north of Kramgasse. */
const OLD_TOWN_HOME: MapPoint = [12, -4];

describe("the drawn city", () => {
  test("without an office it is the city as before: every block and house", () => {
    const drawn = drawnCity(PLAN, null);
    expect(drawn.blocks.length).toBe(788);
    expect(drawn.houses).toBe(OLD_TOWN_HOUSES);
  });

  test("your office clears its lot of houses and blocks, and nothing else", () => {
    const drawn = drawnCity(PLAN, OLD_TOWN_HOME);
    const lot = homeLot(OLD_TOWN_HOME);
    expect(drawn.houses.some((house) => overlaps(lot, house))).toBe(false);
    expect(OLD_TOWN_HOUSES.length - drawn.houses.length).toBe(5);
    expect(drawn.blocks.length).toBe(788);
  });

  test("walls stand where buildings are drawn, your office among them, its door clear", () => {
    const obstacles = cityObstacles(drawnCity(PLAN, OLD_TOWN_HOME), BUILDINGS, OLD_TOWN_HOME);
    expect(obstacles).toContainEqual(homeOffice(OLD_TOWN_HOME));
    const map = cityWalkMap(drawnCity(PLAN, OLD_TOWN_HOME), BUILDINGS, OLD_TOWN_HOME);
    expect(blocked(map, homeDoor(OLD_TOWN_HOME).at, WALKER_RADIUS)).toBe(false);
    expect(blocked(map, OLD_TOWN_HOME, WALKER_RADIUS)).toBe(true);
    for (const building of BUILDINGS) {
      expect(blocked(map, [building.x, building.z], 0)).toBe(true);
    }
  });
});

describe("the Aare", () => {
  const map = cityWalkMap(drawnCity(PLAN, null), BUILDINGS, null);
  const decks = Object.values(BRIDGES).map(bridgeFootprint);

  test("is water all along, except where a bridge deck crosses it", () => {
    const wet = AARE_CURVE.filter((point) => !decks.some((deck) => covers(deck, point)));
    expect(wet.length).toBeGreaterThan(150);
    expect(wet.filter((point) => !blocked(map, point, WALKER_RADIUS))).toEqual([]);
  });

  test("every bridge can be walked across its middle, on the deck", () => {
    for (const deck of decks) {
      expect(blocked(map, [deck.x, deck.z], WALKER_RADIUS)).toBe(false);
      expect(groundHeight(map, [deck.x, deck.z])).toBe(1.5);
    }
  });
});
