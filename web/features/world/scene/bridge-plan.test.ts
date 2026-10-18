import { describe, expect, test } from "bun:test";
import { AARE_WIDTH, BANK_WIDTH, BRIDGE_ARCHES, BRIDGES } from "../geography";
import { distanceToPolyline } from "../geometry";
import { ARCH_RISE, DECK_HEIGHT, bridgeProfile, planBridges } from "./bridge-plan";
import { toWorld } from "./footprint";
import { AARE_CURVE } from "./town";

describe("bridgeProfile", () => {
  test("two arches: abutments, one pier, ramps up to the deck", () => {
    const profile = bridgeProfile(10, 2, 2);
    expect(profile.span).toBeCloseTo(3.9, 10);
    expect(profile.piers).toHaveLength(1);
    expect(profile.piers[0]).toBeCloseTo(5, 10);
    const expected = [
      [0, 0],
      [0.8, 0],
      [2.75, ARCH_RISE],
      [4.7, 0],
      [5.3, 0],
      [7.25, ARCH_RISE],
      [9.2, 0],
      [10, 0],
      [10, 0.2],
      [9, DECK_HEIGHT],
      [1, DECK_HEIGHT],
      [0, 0.2],
    ];
    expect(profile.outline).toHaveLength(expected.length);
    profile.outline.forEach(([x, y], index) => {
      expect(x).toBeCloseTo(expected[index]?.[0] ?? Number.NaN, 10);
      expect(y).toBeCloseTo(expected[index]?.[1] ?? Number.NaN, 10);
    });
  });
});

describe("planBridges", () => {
  const bridges = planBridges(BRIDGES, BRIDGE_ARCHES, 12);

  test("every bridge has its arches, one pier fewer, and openings wider than a pier", () => {
    expect(bridges.map((bridge) => [bridge.id, bridge.profile.piers.length])).toEqual([
      ["kirchenfeld", 1],
      ["kornhaus", 2],
      ["lorraine", 1],
      ["monbijou", 2],
      ["nydegg", 0],
    ]);
    for (const bridge of bridges) expect(bridge.profile.span).toBeGreaterThan(2);
  });

  test("both ends stand on land beyond the banks, so each bridge crosses the Aare", () => {
    for (const bridge of bridges) {
      const half = bridge.footprint.width / 2;
      for (const end of [
        toWorld(bridge.footprint, [-half, 0]),
        toWorld(bridge.footprint, [half, 0]),
      ]) {
        expect(distanceToPolyline(end, AARE_CURVE)).toBeGreaterThan(AARE_WIDTH / 2 + BANK_WIDTH);
      }
      const [mx, mz] = [bridge.footprint.x, bridge.footprint.z];
      expect(distanceToPolyline([mx, mz], AARE_CURVE)).toBeLessThan(bridge.footprint.width / 2);
    }
  });

  test("arches stay under the deck", () => {
    for (const bridge of bridges) {
      for (const [, y] of bridge.profile.outline) {
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeLessThanOrEqual(DECK_HEIGHT);
      }
    }
  });
});
