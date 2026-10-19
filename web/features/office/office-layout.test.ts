import { describe, expect, test } from "bun:test";
import {
  BACK_WALL,
  BOOKSHELF_HEIGHT,
  DOOR,
  FLOOR_ITEMS,
  LEFT_WALL,
  ROOM_HALF,
  WALL_HEIGHT,
  WALL_THICKNESS,
  WINDOW,
  collisions,
  fitZoom,
  insideRoom,
  overlaps,
  wallPieces,
} from "./office-layout";

const box = (id: string, x: number, z: number) => ({ id, x, z, width: 1, depth: 1 });

describe("office layout", () => {
  test("every floor item stands inside the room", () => {
    expect(FLOOR_ITEMS.filter((item) => !insideRoom(item)).map((item) => item.id)).toEqual([]);
  });

  test("no two floor items overlap, and the door is never blocked", () => {
    expect(collisions(FLOOR_ITEMS)).toEqual([]);
  });

  test("the window and the door fit in their walls, and the shelf stands under the ceiling", () => {
    expect(Math.abs(WINDOW.along) + WINDOW.width / 2).toBeLessThan(ROOM_HALF);
    expect(WINDOW.sill + WINDOW.height).toBeLessThan(WALL_HEIGHT);
    expect(Math.abs(DOOR.along) + DOOR.width / 2).toBeLessThan(ROOM_HALF);
    expect(DOOR.height).toBeLessThan(WALL_HEIGHT);
    expect(BOOKSHELF_HEIGHT).toBeLessThan(WALL_HEIGHT);
  });
});

describe("overlaps", () => {
  test("rectangles that share only an edge do not overlap", () => {
    expect(overlaps(box("a", 0, 0), box("b", 1, 0))).toBe(false);
    expect(overlaps(box("a", 0, 0), box("b", 0.99, 0.5))).toBe(true);
  });

  test("collisions names each overlapping pair once", () => {
    expect(collisions([box("a", 0, 0), box("b", 0.5, 0), box("c", 3, 3)])).toEqual([["a", "b"]]);
  });
});

describe("wallPieces", () => {
  test("a window leaves full-height pieces either side and pieces below and above", () => {
    expect(wallPieces(-3, 3, { along: 0, width: 2, bottom: 1, top: 2 })).toEqual([
      { start: -3, end: -1, bottom: 0, top: WALL_HEIGHT },
      { start: 1, end: 3, bottom: 0, top: WALL_HEIGHT },
      { start: -1, end: 1, bottom: 0, top: 1 },
      { start: -1, end: 1, bottom: 2, top: WALL_HEIGHT },
    ]);
  });

  test("a door on the floor has no piece below it", () => {
    expect(wallPieces(-3, 3, { along: 1, width: 1, bottom: 0, top: 2 })).toEqual([
      { start: -3, end: 0.5, bottom: 0, top: WALL_HEIGHT },
      { start: 1.5, end: 3, bottom: 0, top: WALL_HEIGHT },
      { start: 0.5, end: 1.5, bottom: 2, top: WALL_HEIGHT },
    ]);
  });

  test("the back wall closes the corner over the left wall", () => {
    expect(BACK_WALL[0]?.start).toBe(-ROOM_HALF - WALL_THICKNESS);
    expect(LEFT_WALL).toHaveLength(3);
  });
});

describe("fitZoom", () => {
  test("the narrower side of the canvas sets the zoom", () => {
    expect(fitZoom(960, 2000)).toBe(100);
    expect(fitZoom(2000, 760)).toBe(100);
  });

  test("an unmeasured canvas still gets a usable zoom", () => {
    expect(fitZoom(0, 0)).toBe(1);
  });
});
