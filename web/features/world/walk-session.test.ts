import { describe, expect, test } from "bun:test";
import { type MapPoint } from "./geography";
import { besideSpot, extendTrail, FOLLOW_GAP, pointBehind, startTrail } from "./trail";
import { WALKER_RADIUS } from "./walk";
import { walkMap } from "./walk-map";
import { advance, arrive, withPath } from "./walk-session";

// Open ground with one wall just east of the middle.
const MAP = walkMap({
  bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
  obstacles: [{ x: 1.5, z: 0, width: 1, depth: 4, angle: 0 }],
  river: [],
  riverHalfWidth: 1,
  decks: [],
  deck: { height: 1.5, endHeight: 0.2, ramp: 1 },
});
const frame = { held: new Set<string>(), azimuth: 0, seconds: 0.1, snapTurn: true };

describe("the trail your agent follows", () => {
  test("keeps a point only once you have moved a little, newest first", () => {
    const trail = extendTrail([[0, 0]], [0, 0.1]);
    expect(trail).toEqual([[0, 0]]);
    expect(extendTrail(trail, [0, 0.5])).toEqual([
      [0, 0.5],
      [0, 0],
    ]);
  });

  test("forgets what lies well behind the agent", () => {
    let trail: readonly MapPoint[] = [[0, 0]];
    for (let step = 1; step <= 40; step++) trail = extendTrail(trail, [0, step * 0.5]);
    expect(trail.length).toBe(6);
    expect(trail[0]).toEqual([0, 20]);
  });

  test("gives the point a set distance back along the way you came", () => {
    const trail: MapPoint[] = [
      [0, 2],
      [0, 1],
      [1, 1],
    ];
    expect(pointBehind(trail, 0.5)).toEqual([0, 1.5]);
    expect(pointBehind(trail, 1.5)).toEqual([0.5, 1]);
    expect(pointBehind(trail, 9)).toEqual([1, 1]);
  });

  test("your agent stands at your right, else your left, else behind you", () => {
    expect(besideSpot(MAP, [0, 0], 0, WALKER_RADIUS)).toEqual([-1.1, 0]);
    const [x, z] = besideSpot(MAP, [0, 0], Math.PI, WALKER_RADIUS);
    expect(x).toBeCloseTo(-1.1, 12);
    expect(z).toBeCloseTo(0, 12);
  });
});

describe("a walk", () => {
  test("arriving puts you facing the camera with your agent beside you, nobody walking", () => {
    const session = arrive(MAP, [0, 0]);
    expect(session.walker).toEqual({ at: [0, 0], heading: 0, path: [] });
    expect(session.agent).toEqual({ at: [-1.1, 0], heading: 0 });
    expect(session.trail).toEqual(startTrail([0, 0], [-1.1, 0]));
    const step = advance(MAP, session, frame);
    expect([step.walked, step.agentWalked]).toEqual([false, false]);
    expect(step.session.agent).toBe(session.agent);
  });

  test("your agent steps into your track and follows a gap behind, facing where it goes", () => {
    let session = withPath(arrive(MAP, [0, 0]), [[0, -6]]);
    const agentWalked: boolean[] = [];
    for (let tick = 0; tick < 10; tick++) {
      const step = advance(MAP, session, frame);
      session = step.session;
      agentWalked.push(step.agentWalked);
    }
    expect(session.walker.at[1]).toBeCloseTo(-6, 12);
    const [ax, az] = session.agent.at;
    expect(ax).toBeCloseTo(0, 12);
    expect(az).toBeCloseTo(-6 + FOLLOW_GAP, 12);
    expect(session.agent.heading).toBeCloseTo(Math.PI, 12);
    expect(agentWalked).toEqual(Array<boolean>(10).fill(true));
  });

  test("held keys walk you relative to the view", () => {
    const step = advance(MAP, arrive(MAP, [-5, 0]), { ...frame, held: new Set(["w"]) });
    expect(step.walked).toBe(true);
    expect(step.session.walker.at[0]).toBe(-5);
    expect(step.session.walker.at[1]).toBeCloseTo(-0.6, 12);
  });
});
