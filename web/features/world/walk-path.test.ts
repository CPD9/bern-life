import { describe, expect, test } from "bun:test";
import { type MapPoint } from "./geography";
import { buildGrid, cellAt, nearestCell } from "./walk-grid";
import { findPath, type Planner, pullStraight } from "./walk-path";

const SQUARE = { minX: 0, maxX: 5, minZ: 0, maxZ: 5 };
const walled = ([x, z]: MapPoint) => !(x > 2 && x < 3 && z < 4);
const split = ([x]: MapPoint) => !(x > 2 && x < 3);
/** Five by five cells; a wall down column 2 from the top, open only in the bottom row. */
const WALLED = buildGrid(walled, SQUARE, 1);
/** The same square cut in two by a wall all the way down. */
const SPLIT = buildGrid(split, SQUARE, 1);
const AROUND_WALL: Planner = { grid: WALLED, free: walled };
const ACROSS_SPLIT: Planner = { grid: SPLIT, free: split };

describe("the walk grid", () => {
  test("a cell is open when its centre is, and joined cells share a region", () => {
    expect([...WALLED.open].join("")).toBe("1101111011110111101111111");
    expect(new Set(WALLED.region)).toEqual(new Set([0, -1]));
    expect(new Set(SPLIT.region)).toEqual(new Set([0, 1, -1]));
  });

  test("the nearest reachable cell to a click in a wall is beside it, in your region", () => {
    expect(nearestCell(WALLED, [2.5, 1.5], 0)).toBe(cellAt(WALLED, [1.5, 1.5]));
    expect(nearestCell(SPLIT, [4.5, 4.5], 0)).toBe(cellAt(SPLIT, [1.5, 4.5]));
  });
});

describe("click-to-walk", () => {
  test("goes round a wall through its one gap, in straight lines", () => {
    expect(findPath(AROUND_WALL, [0.5, 0.5], [4.5, 0.5])).toEqual([
      [1.5, 4.5],
      [3.5, 4.5],
      [4.5, 0.5],
    ]);
  });

  test("walks straight to a clicked spot in view, exactly there", () => {
    expect(findPath(AROUND_WALL, [0.2, 0.7], [0.9, 3.4])).toEqual([[0.9, 3.4]]);
  });

  test("a click it cannot reach walks you to the nearest spot it can", () => {
    expect(findPath(AROUND_WALL, [0.5, 0.5], [2.5, 1.5])).toEqual([[1.5, 1.5]]);
    expect(findPath(ACROSS_SPLIT, [0.5, 0.5], [4.5, 4.5])).toEqual([[1.5, 4.5]]);
  });

  test("a straight line never cuts a wall's corner that lies between cell centres", () => {
    // A post stands in the open cell at (1.5, 1.5) without covering its centre: the cells alone
    // see straight from (0.5, 0.5) to (2.5, 2.5), and a walker on that line would stop at it.
    const posted = ([x, z]: MapPoint) => !(x > 1.7 && x < 1.9 && z > 1.7 && z < 1.9);
    const planner: Planner = { grid: buildGrid(posted, SQUARE, 1), free: posted };
    expect([...planner.grid.open].every((open) => open === 1)).toBe(true);
    const round: MapPoint[] = [
      [0.5, 0.5],
      [1.5, 0.5],
      [2.5, 0.5],
      [2.5, 1.5],
      [2.5, 2.5],
    ];
    expect(pullStraight(planner, round)).toEqual([
      [0.5, 0.5],
      [2.5, 1.5],
      [2.5, 2.5],
    ]);
  });

  test("pulling straight keeps only the corners", () => {
    const stairs: MapPoint[] = [
      [0.5, 0.5],
      [0.5, 1.5],
      [0.5, 2.5],
      [1.5, 3.5],
      [1.5, 4.5],
      [2.5, 4.5],
    ];
    expect(pullStraight(AROUND_WALL, stairs)).toEqual([
      [0.5, 0.5],
      [1.5, 4.5],
      [2.5, 4.5],
    ]);
  });
});
