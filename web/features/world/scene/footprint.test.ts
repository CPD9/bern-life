import { describe, expect, test } from "bun:test";
import { angleToward, corners, covers, coveredByAny, overlaps, toWorld } from "./footprint";

const square = { x: 0, z: 0, width: 2, depth: 2, angle: 0 };

describe("footprint", () => {
  test("angleToward turns local +x toward the direction, as three.js turns a mesh", () => {
    const south = { x: 5, z: 5, width: 4, depth: 1, angle: angleToward(0, 1) };
    const [x, z] = toWorld(south, [2, 0]);
    expect(x).toBeCloseTo(5, 10);
    expect(z).toBeCloseTo(7, 10);
  });

  test("a long footprint turned a quarter covers along z, not along x", () => {
    const turned = { x: 0, z: 0, width: 6, depth: 1, angle: angleToward(0, 1) };
    expect(covers(turned, [0, 2.9])).toBe(true);
    expect(covers(turned, [2.9, 0])).toBe(false);
    expect(covers(turned, [0.9, 0], 0.5)).toBe(true);
  });

  test("corners go round the rectangle", () => {
    expect(corners({ x: 1, z: 2, width: 2, depth: 4, angle: 0 })).toEqual([
      [0, 0],
      [2, 0],
      [2, 4],
      [0, 4],
    ]);
  });

  test("overlaps separates boxes that only meet on a diagonal", () => {
    const diamond = { x: 2.3, z: 2.3, width: 2, depth: 2, angle: Math.PI / 4 };
    expect(overlaps(square, diamond)).toBe(false);
    expect(overlaps(square, { ...diamond, x: 1.6, z: 1.6 })).toBe(true);
    expect(overlaps(square, { ...square, x: 2.5 })).toBe(false);
    expect(overlaps(square, { ...square, x: 2.5 }, 0.6)).toBe(true);
  });

  test("coveredByAny checks every footprint", () => {
    expect(coveredByAny([square, { ...square, x: 10 }], [10.5, 0], 0)).toBe(true);
    expect(coveredByAny([square, { ...square, x: 10 }], [5, 0], 1)).toBe(false);
  });
});
