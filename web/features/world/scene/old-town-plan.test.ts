import { describe, expect, test } from "bun:test";
import { DISTRICTS, type MapPoint, RATHAUSPLATZ } from "../geography";
import { distanceToPolyline, pointInPolygon } from "../geometry";
import { paletteFor } from "../palette";
import { corners, overlaps } from "./footprint";
import { LANDMARK_BUILDINGS } from "./landmark-plan";
import { type OldTownInput, planOldTown, ROW_OFFSETS } from "./old-town-plan";
import {
  AARE_CURVE,
  HOUSE_TONES,
  OLD_TOWN_HOUSES,
  OLD_TOWN_STREETS,
  RIVER_CLEARANCE,
  STREET_CLEARANCE,
} from "./town";

const STRAIGHT: OldTownInput = {
  outline: [
    [0, -5],
    [12, -5],
    [12, 5],
    [0, 5],
  ],
  axis: [
    [0, 0],
    [12, 0],
  ],
  river: [
    [0, 50],
    [12, 50],
  ],
  riverClearance: 2,
  streets: [],
  streetClearance: 0.85,
  keepClear: [],
  sites: [],
  tones: { walls: 3, roofs: 3 },
  seed: 7,
};

describe("planOldTown", () => {
  test("rows come in back-to-back pairs either side of the axis, a lane between pairs", () => {
    const expected = [
      [-3.3, -1.7, 1.7, 3.3],
      [-7.2, -5.6, 5.6, 7.2],
      [-11.1, -9.5, 9.5, 11.1],
      [-15, -13.4, 13.4, 15],
      [-18.9, -17.3, 17.3, 18.9],
    ].flat();
    expect(ROW_OFFSETS).toHaveLength(expected.length);
    ROW_OFFSETS.forEach((offset, index) => expect(offset).toBeCloseTo(expected[index] ?? 0, 10));
  });

  test("along a straight axis, houses stand square in the four nearest rows", () => {
    const houses = planOldTown(STRAIGHT);
    expect(houses.length).toBeGreaterThan(30);
    const rows = [...new Set(houses.map((house) => Number(house.z.toFixed(6))))].sort(
      (a, b) => a - b,
    );
    expect(rows).toEqual([-3.3, -1.7, 1.7, 3.3]);
    for (const house of houses) {
      expect(house.angle).toBeCloseTo(0, 10);
      expect(house.width).toBeGreaterThan(0.7);
      expect(house.width).toBeLessThan(1.15);
    }
  });

  test("the same seed builds the same town; a landmark keeps its square", () => {
    expect(planOldTown(STRAIGHT)).toEqual(planOldTown(STRAIGHT));
    const tower = { x: 6, z: 1.7, width: 1, depth: 1, angle: 0 };
    const houses = planOldTown({ ...STRAIGHT, keepClear: [tower] });
    expect(houses.some((house) => overlaps(tower, house, 0.8))).toBe(false);
    expect(houses.length).toBeLessThan(planOldTown(STRAIGHT).length);
  });
});

describe("the Old Town of Bern", () => {
  const outline = DISTRICTS.find((district) => district.id === "old-town")?.outline ?? [];

  test("hundreds of houses, all inside the Old Town", () => {
    expect(OLD_TOWN_HOUSES.length).toBeGreaterThan(400);
    for (const house of OLD_TOWN_HOUSES)
      expect(pointInPolygon([house.x, house.z], outline)).toBe(true);
  });

  test("no house stands in the river or on its banks, on a street or on a bridge", () => {
    for (const house of OLD_TOWN_HOUSES) {
      const points: MapPoint[] = [[house.x, house.z], ...corners(house)];
      for (const point of points) {
        expect(distanceToPolyline(point, AARE_CURVE)).toBeGreaterThanOrEqual(RIVER_CLEARANCE);
        for (const street of OLD_TOWN_STREETS) {
          expect(distanceToPolyline(point, street)).toBeGreaterThanOrEqual(STREET_CLEARANCE);
        }
      }
    }
  });

  test("no house overlaps another, a landmark or the agents' square", () => {
    const houses = OLD_TOWN_HOUSES;
    houses.forEach((house, index) => {
      for (const other of houses.slice(index + 1)) {
        if (Math.hypot(house.x - other.x, house.z - other.z) > 2) continue;
        expect(overlaps(house, other)).toBe(false);
      }
      for (const { footprint } of LANDMARK_BUILDINGS)
        expect(overlaps(footprint, house)).toBe(false);
      expect(Math.hypot(house.x - RATHAUSPLATZ[0], house.z - RATHAUSPLATZ[1])).toBeGreaterThan(3);
    });
  });

  test("both palettes carry a wall and a roof colour for every house tone", () => {
    for (const palette of [paletteFor(false), paletteFor(true)]) {
      expect(palette.houseWalls).toHaveLength(HOUSE_TONES.walls);
      expect(palette.roofs).toHaveLength(HOUSE_TONES.roofs);
    }
  });
});
