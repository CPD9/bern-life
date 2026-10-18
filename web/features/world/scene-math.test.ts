import { describe, expect, test } from "bun:test";
import {
  commandForKey,
  focusTarget,
  panOffset,
  PAN_STEP,
  START_VIEW,
  startPosition,
} from "./camera-moves";
import { CLEARANCE, liteTrees, planCity, type CityInput } from "./city-plan";
import {
  AARE_PATH,
  AARE_WIDTH,
  DISTRICTS,
  LANDMARKS,
  MAP_BOUNDS,
  MAP_LABELS,
  OLD_TOWN_AXIS,
  RATHAUSPLATZ,
  ROADS,
  ROAD_WIDTH,
} from "./geography";
import { distanceToPolyline, pointInPolygon } from "./geometry";
import { PLACES } from "./places";
import { ribbon, smoothPath } from "./ribbon";
import { bernHour, lightingAt, phaseAt } from "./sky";

describe("ribbon", () => {
  test("a straight line gives a band of exact width with two triangles per segment", () => {
    const band = ribbon(
      [
        [0, 0],
        [10, 0],
        [20, 0],
      ],
      2,
      0.5,
    );
    expect([...band.positions]).toEqual([
      0, 0.5, 1, 0, 0.5, -1, 10, 0.5, 1, 10, 0.5, -1, 20, 0.5, 1, 20, 0.5, -1,
    ]);
    expect([...band.indices]).toEqual([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]);
  });

  test("a single point gives no triangles", () => {
    expect(ribbon([[3, 4]], 2, 0).indices.length).toBe(0);
  });
});

describe("smoothPath", () => {
  const bend: [number, number][] = [
    [0, 0],
    [10, 0],
    [10, 10],
    [20, 10],
  ];

  test("passes through every point, with the given steps per segment", () => {
    const curve = smoothPath(bend, 4);
    expect(curve).toHaveLength(3 * 4 + 1);
    bend.forEach(([x, z], index) => {
      expect(curve[index * 4]?.[0]).toBeCloseTo(x, 10);
      expect(curve[index * 4]?.[1]).toBeCloseTo(z, 10);
    });
  });

  test("a straight line stays straight; two points or one step stay as given", () => {
    const line = smoothPath(
      [
        [0, 0],
        [5, 0],
        [10, 0],
      ],
      5,
    );
    line.forEach(([x, z], index) => {
      expect(z).toBeCloseTo(0, 10);
      expect(x).toBeGreaterThan(line[index - 1]?.[0] ?? -1);
    });
    expect(line[5]?.[0]).toBeCloseTo(5, 10);
    expect(smoothPath(bend.slice(0, 2), 4)).toEqual(bend.slice(0, 2));
    expect(smoothPath(bend, 1)).toEqual(bend);
  });

  test("the smoothed Aare stays within half a river's width of the drawn one", () => {
    for (const point of smoothPath(AARE_PATH, 8)) {
      expect(distanceToPolyline(point, AARE_PATH)).toBeLessThan(AARE_WIDTH / 2);
    }
  });
});

describe("map labels", () => {
  test("each district label stands in its district, the Aare's on the water", () => {
    expect(MAP_LABELS.map((label) => label.name)).toEqual([
      "Aare",
      "Altstadt",
      "Länggasse",
      "Insel",
      "Kirchenfeld",
      "Lorraine",
      "Mattenhof",
      "Liebefeld",
    ]);
    for (const label of MAP_LABELS) {
      const district = DISTRICTS.find((candidate) => candidate.id === label.district);
      if (district === undefined) {
        expect(distanceToPolyline(label.at, AARE_PATH)).toBeLessThan(AARE_WIDTH / 2);
      } else {
        expect(pointInPolygon(label.at, district.outline)).toBe(true);
      }
    }
  });

  test("the Old Town's main street runs under the Zytglogge", () => {
    expect(distanceToPolyline(LANDMARKS.zytglogge, OLD_TOWN_AXIS)).toBe(0);
    expect(ROADS[0]).toBe(OLD_TOWN_AXIS);
  });
});

describe("planCity", () => {
  const input: CityInput = {
    districts: DISTRICTS,
    river: AARE_PATH,
    roads: ROADS,
    sites: [...PLACES.map((place): [number, number] => [place.x, place.z]), RATHAUSPLATZ],
    bounds: MAP_BOUNDS,
    seed: 1291,
  };
  const plan = planCity(input);

  test("the same seed lays out the same city", () => {
    expect(planCity(input)).toEqual(plan);
    expect(planCity({ ...input, seed: 1292 })).not.toEqual(plan);
  });

  test("every district but the Old Town gets generic buildings; the Old Town has its rows", () => {
    const withBlocks = DISTRICTS.filter((district) =>
      plan.blocks.some((block) => pointInPolygon([block.x, block.z], district.outline)),
    ).map((district) => district.id);
    expect(withBlocks).toEqual(
      DISTRICTS.map((district) => district.id).filter((id) => id !== "old-town"),
    );
  });

  test("no building stands in the river, on a road or on a place site", () => {
    for (const block of plan.blocks) {
      const at: [number, number] = [block.x, block.z];
      expect(distanceToPolyline(at, AARE_PATH)).toBeGreaterThanOrEqual(CLEARANCE.river);
      for (const road of ROADS) {
        expect(distanceToPolyline(at, road)).toBeGreaterThanOrEqual(CLEARANCE.road);
      }
      for (const [x, z] of input.sites) {
        expect(Math.hypot(block.x - x, block.z - z)).toBeGreaterThanOrEqual(CLEARANCE.site);
      }
    }
  });

  test("lite graphics keeps every third tree", () => {
    const trees: [number, number][] = [
      [0, 0],
      [1, 1],
      [2, 2],
      [3, 3],
    ];
    expect(liteTrees(trees)).toEqual([
      [0, 0],
      [3, 3],
    ]);
  });
});

describe("place sites", () => {
  test("no place building sits on a road or in the river", () => {
    for (const place of PLACES) {
      const at: [number, number] = [place.x, place.z];
      for (const road of ROADS) {
        expect(distanceToPolyline(at, road)).toBeGreaterThan(ROAD_WIDTH / 2 + 1.2);
      }
      expect(distanceToPolyline(at, AARE_PATH)).toBeGreaterThan(CLEARANCE.river);
    }
  });
});

describe("lighting", () => {
  test("the hour picks the phase", () => {
    expect([3, 6.5, 8.99, 9, 12, 17, 19.5, 20].map(phaseAt)).toEqual([
      "night",
      "dawn",
      "dawn",
      "day",
      "day",
      "dusk",
      "dusk",
      "night",
    ]);
  });

  test("day mode at midday: bright sun due south", () => {
    const light = lightingAt(13, false);
    expect(light.phase).toBe("day");
    expect(light.sunColour).toBe("#fff6e8");
    expect(light.sunIntensity).toBe(2.2);
    expect(light.sunDirection[0]).toBeCloseTo(0, 10);
    expect(light.sunDirection[1]).toBeCloseTo(Math.sin(0.9), 10);
    expect(light.sunDirection[2]).toBeCloseTo(Math.cos(0.9), 10);
  });

  test("day mode at a night hour shows dusk; night mode is always night", () => {
    expect(lightingAt(3, false).phase).toBe("dusk");
    expect(lightingAt(3, false).skyColour).toBe("#d4dcf0");
    expect(lightingAt(12, true).phase).toBe("night");
    expect(lightingAt(12, true).sunIntensity).toBe(1.4);
  });

  test("at 19:00 the sun stands in the west", () => {
    expect(lightingAt(19, false).sunDirection[0]).toBeLessThan(-0.9);
  });

  test("Bern hour uses Europe/Zurich, summer and winter time", () => {
    expect(bernHour(new Date("2026-10-18T12:30:00Z"))).toBe(14.5);
    expect(bernHour(new Date("2026-12-01T12:30:00Z"))).toBe(13.5);
  });
});

describe("camera keys", () => {
  test("keys map to steps, letters in either case, others to nothing", () => {
    expect(commandForKey("ArrowUp")).toEqual({ kind: "pan", right: 0, forward: 1 });
    expect(commandForKey("D")).toEqual({ kind: "pan", right: 1, forward: 0 });
    expect(commandForKey("q")).toEqual({ kind: "rotate", steps: -1 });
    expect(commandForKey("+")).toEqual({ kind: "zoom", steps: 1 });
    expect(commandForKey("-")).toEqual({ kind: "zoom", steps: -1 });
    expect(commandForKey("Enter")).toBeNull();
  });

  test("forward moves north when the map faces north, east when it is turned a quarter", () => {
    const north = panOffset(0, 0, 1);
    expect(north[0]).toBeCloseTo(0, 10);
    expect(north[1]).toBeCloseTo(-PAN_STEP, 10);
    const turned = panOffset(-Math.PI / 2, 0, 1);
    expect(turned[0]).toBeCloseTo(PAN_STEP, 10);
    expect(turned[1]).toBeCloseTo(0, 10);
  });
});

describe("start view", () => {
  function distance(aspect: number): number {
    const [x, y, z] = startPosition(aspect);
    const [tx, , tz] = START_VIEW.target;
    return Math.hypot(x - tx, y, z - tz);
  }

  test("landscape keeps the base distance; portrait pulls back, at most 1.7 times", () => {
    expect(distance(1.6)).toBeCloseTo(175, 10);
    expect(distance(0.88)).toBeCloseTo(218.75, 10);
    expect(distance(0.46)).toBeCloseTo(297.5, 10);
  });
});

describe("focusTarget", () => {
  test("landscape centres the place; portrait stops 12 units short, toward the viewer", () => {
    expect(focusTarget(-37, -17.6, 0, false)).toEqual([-37, -17.6]);
    const [x, z] = focusTarget(-37, -17.6, 0, true);
    expect(x).toBeCloseTo(-37, 10);
    expect(z).toBeCloseTo(-5.6, 10);
  });
});
