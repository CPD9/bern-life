import { describe, expect, test } from "bun:test";
import { BRIDGES, type MapPoint } from "./geography";
import { angleToward } from "./scene/footprint";
import { bridgeFootprint } from "./scene/bridge-plan";
import { bridgeRails } from "./drawn-city";
import {
  keyDirection,
  move,
  slide,
  turn,
  type Walker,
  WALK_SPEED,
  WALKER_RADIUS,
  walkTick,
} from "./walk";
import { blocked, groundHeight, walkMap } from "./walk-map";

// An invented square of ground: one house north of the middle, a river running east-west in the
// south, and a bridge across it on x = 0.
const BRIDGE = { x: 0, z: -5, width: 6, depth: 1.3, angle: angleToward(0, 1) };
const MAP = walkMap({
  bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
  obstacles: [{ x: 0, z: 3, width: 4, depth: 2, angle: 0 }, ...bridgeRails(BRIDGE)],
  river: [
    [-10, -5],
    [10, -5],
  ],
  riverHalfWidth: 1,
  decks: [BRIDGE],
  deck: { height: 1.5, endHeight: 0.2, ramp: 1 },
});
const R = WALKER_RADIUS;

function standing(at: MapPoint, path: readonly MapPoint[] = []): Walker {
  return { at, heading: 0, path };
}

const still = { direction: [0, 0] as MapPoint, seconds: 0.1, snapTurn: false };

describe("collision", () => {
  test("a house blocks its footprint plus the walker's radius, and nothing beyond", () => {
    expect(blocked(MAP, [0, 1.74], R)).toBe(false);
    expect(blocked(MAP, [0, 1.76], R)).toBe(true);
    expect(blocked(MAP, [2.2, 3], R)).toBe(true);
    expect(blocked(MAP, [2.3, 3], R)).toBe(false);
  });

  test("the map's edge is a wall", () => {
    expect(blocked(MAP, [9.7, 0], R)).toBe(false);
    expect(blocked(MAP, [9.8, 0], R)).toBe(true);
    expect(blocked(MAP, [0, -9.8], R)).toBe(true);
  });

  test("the river blocks off the bridge; on the deck it does not", () => {
    expect(blocked(MAP, [5, -5], R)).toBe(true);
    expect(blocked(MAP, [5, -3.9], R)).toBe(false);
    expect(blocked(MAP, [0, -5], R)).toBe(false);
    expect(blocked(MAP, [0.8, -5], R)).toBe(true);
  });

  test("the bridge's railings keep you on the deck, except at the ramps", () => {
    expect(blocked(MAP, [0.5, -5], R)).toBe(true);
    expect(blocked(MAP, [-0.5, -3], R)).toBe(true);
    expect(blocked(MAP, [0.5, -2.5], R)).toBe(false);
  });

  test("the deck is level in the middle and ramps down to its ends", () => {
    expect(groundHeight(MAP, [0, -5])).toBe(1.5);
    expect(groundHeight(MAP, [0, -2.5])).toBeCloseTo(0.85, 12);
    expect(groundHeight(MAP, [0, -1])).toBe(0);
  });
});

describe("sliding", () => {
  test("a step into a wall at an angle keeps its sideways part and ends against the wall", () => {
    expect(slide(MAP, [0, 1.5], [0.5, 1.8], R)).toEqual([0.5, 1.74375]);
  });

  test("a step straight into a wall ends against it", () => {
    expect(slide(MAP, [0, 1.5], [0, 1.8], R)).toEqual([0, 1.74375]);
  });

  test("a step that starts against the wall goes nowhere", () => {
    expect(slide(MAP, [0, 1.749], [0, 1.8], R)).toEqual([0, 1.749]);
  });

  test("a long step stops touching the wall instead of passing through it", () => {
    expect(move(MAP, [0, 0], [0, 6], R)).toEqual([0, 1.75]);
    expect(blocked(MAP, [0, 1.75], R)).toBe(false);
  });

  test("walking diagonally along a facade slides along it", () => {
    const [x, z] = move(MAP, [-1, 1.6], [2, 1], R);
    expect(x).toBeCloseTo(1, 12);
    expect(z).toBeCloseTo(1.75, 2);
    expect(z).toBeLessThan(1.75);
  });
});

describe("walking", () => {
  test("held keys walk relative to the view: up walks away from the camera", () => {
    const [x, z] = keyDirection(0, 0, 1);
    expect(x).toBeCloseTo(0, 12);
    expect(z).toBe(-1);
    const [rx, rz] = keyDirection(Math.PI / 2, 1, 0);
    expect(rx).toBeCloseTo(0, 12);
    expect(rz).toBe(-1);
  });

  test("keys move you at walking speed and drop a path", () => {
    const walker = walkTick(MAP, standing([-5, 0], [[5, 0]]), {
      direction: [1, 0],
      seconds: 0.25,
      snapTurn: true,
    });
    expect(walker.at[0]).toBeCloseTo(-5 + WALK_SPEED * 0.25, 12);
    expect(walker.at[1]).toBe(0);
    expect(walker.heading).toBe(Math.PI / 2);
    expect(walker.path).toEqual([]);
  });

  test("a path is walked point by point and ends where it was going", () => {
    let walker = standing(
      [-5, 0],
      [
        [-5, -1],
        [-4, -1],
      ],
    );
    const seen: number[] = [];
    for (let frame = 0; frame < 10; frame++) {
      walker = walkTick(MAP, walker, still);
      seen.push(walker.path.length);
    }
    expect(walker.at[0]).toBeCloseTo(-4, 12);
    expect(walker.at[1]).toBeCloseTo(-1, 12);
    expect(seen).toEqual([2, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  });

  test("a path into a wall stops you at it and is dropped", () => {
    let walker = standing([0, 0], [[0, 3]]);
    for (let frame = 0; frame < 10; frame++) walker = walkTick(MAP, walker, still);
    expect(walker.at[1]).toBeCloseTo(1.75, 2);
    expect(walker.path).toEqual([]);
  });

  test("standing with no keys and no path changes nothing", () => {
    const walker = standing([1, 1]);
    expect(walkTick(MAP, walker, still)).toBe(walker);
  });

  test("you turn toward where you walk, the short way round; reduced motion turns at once", () => {
    expect(turn(0, Math.PI / 2, 0.5)).toBe(0.5);
    expect(turn(3, -3, 0.1)).toBeCloseTo(3.1, 12);
    expect(turn(0, 0.05, 0.1)).toBe(0.05);
    const snapped = walkTick(MAP, standing([-5, 0]), {
      ...still,
      direction: [0, -1],
      snapTurn: true,
    });
    expect(snapped.heading).toBe(Math.PI);
  });
});

describe("a bridge", () => {
  test("Kirchenfeld's deck carries you over water; beside it the water stops you", () => {
    const [from, to] = BRIDGES.kirchenfeld;
    const deck = bridgeFootprint(BRIDGES.kirchenfeld);
    const middle: MapPoint = [deck.x, deck.z];
    const across = walkMap({
      bounds: { minX: -20, maxX: 30, minZ: -10, maxZ: 40 },
      obstacles: bridgeRails(deck),
      river: [
        [-20, 13],
        [30, 13],
      ],
      riverHalfWidth: 1.5,
      decks: [deck],
      deck: { height: 1.5, endHeight: 0.2, ramp: 1 },
    });
    let walker = standing(from, [to]);
    for (let frame = 0; frame < 60 && walker.path.length > 0; frame++) {
      walker = walkTick(across, walker, still);
    }
    expect(walker.at[0]).toBeCloseTo(to[0], 12);
    expect(walker.at[1]).toBeCloseTo(to[1], 12);
    expect(groundHeight(across, middle)).toBe(1.5);
    let beside = standing([deck.x + 3, 5], [[deck.x + 3, 20]]);
    for (let frame = 0; frame < 60 && beside.path.length > 0; frame++) {
      beside = walkTick(across, beside, still);
    }
    expect(beside.at[1]).toBeCloseTo(11.5, 2);
    expect(beside.at[1]).toBeLessThan(11.5);
    expect(beside.path).toEqual([]);
  });
});
