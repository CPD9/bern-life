import { describe, expect, test } from "bun:test";
import { groupPlacesByBuilding } from "../buildings";
import {
  AARE_WIDTH,
  BANK_WIDTH,
  LANDMARKS,
  MAP_BOUNDS,
  OLD_TOWN_AXIS,
  ROAD_WIDTH,
  ROADS,
} from "../geography";
import { distanceToPolyline } from "../geometry";
import { PLACES } from "../places";
import { corners, overlaps } from "./footprint";
import { LANDMARK_BUILDINGS } from "./landmark-plan";
import { AARE_CURVE } from "./town";

/** A place building's campus plate (scene/place-buildings.tsx). */
const CAMPUS = 4.6;

describe("landmarks", () => {
  test("the five landmarks, each at its point in the map frame, the Zytglogge at the origin", () => {
    expect(LANDMARK_BUILDINGS.map((landmark) => landmark.id)).toEqual([
      "zytglogge",
      "muenster",
      "bundeshaus",
      "hauptgebaeude",
      "bahnhof",
    ]);
    for (const { id, footprint } of LANDMARK_BUILDINGS) {
      expect([footprint.x, footprint.z]).toEqual([...LANDMARKS[id]]);
      for (const [x, z] of corners(footprint)) {
        expect(x).toBeGreaterThan(MAP_BOUNDS.minX);
        expect(x).toBeLessThan(MAP_BOUNDS.maxX);
        expect(z).toBeGreaterThan(MAP_BOUNDS.minZ);
        expect(z).toBeLessThan(MAP_BOUNDS.maxZ);
      }
    }
    expect(LANDMARKS.zytglogge).toEqual([0, 0]);
    expect(distanceToPolyline(LANDMARKS.zytglogge, OLD_TOWN_AXIS)).toBe(0);
  });

  test("every part stands inside its landmark's footprint", () => {
    for (const { footprint, parts } of LANDMARK_BUILDINGS) {
      for (const { at, size } of parts) {
        expect(Math.abs(at[0]) + size[0] / 2).toBeLessThanOrEqual(footprint.width / 2 + 1e-9);
        expect(Math.abs(at[2]) + size[2] / 2).toBeLessThanOrEqual(footprint.depth / 2 + 1e-9);
      }
    }
  });

  test("the Münster spire is the tallest thing in town", () => {
    const tops = LANDMARK_BUILDINGS.map(({ parts }) =>
      Math.max(...parts.map(({ at, size }) => at[1] + size[1])),
    );
    [4.8, 7.2, 3.8, 3.1, 1.22].forEach((top, index) => expect(tops[index]).toBeCloseTo(top, 10));
  });

  test("no landmark stands in the river, on its banks or on a place's plate", () => {
    const buildings = groupPlacesByBuilding(PLACES);
    for (const { footprint } of LANDMARK_BUILDINGS) {
      for (const corner of corners(footprint)) {
        expect(distanceToPolyline(corner, AARE_CURVE)).toBeGreaterThan(AARE_WIDTH / 2 + BANK_WIDTH);
      }
      for (const { x, z } of buildings) {
        const plate = { x, z, width: CAMPUS, depth: CAMPUS, angle: 0 };
        expect(overlaps(footprint, plate)).toBe(false);
      }
    }
  });

  test("only the Zytglogge stands in a street: it spans the main one", () => {
    const inStreet = LANDMARK_BUILDINGS.filter(({ footprint }) =>
      ROADS.some((road) =>
        [[footprint.x, footprint.z] as const, ...corners(footprint)].some(
          (point) => distanceToPolyline(point, road) < ROAD_WIDTH / 2,
        ),
      ),
    ).map((landmark) => landmark.id);
    expect(inStreet).toEqual(["zytglogge"]);
  });
});
