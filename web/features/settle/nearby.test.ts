import { describe, expect, test } from "bun:test";
import { approximateMetres, distanceLabel, fetchedOn, type MapPlace, nearbyPlaces } from "./nearby";

const ORIGIN = { x: 0, z: 0 };

function place(id: string, x: number, z: number, sourced = true): MapPlace {
  return {
    id,
    name: `Demo ${id}`,
    x,
    z,
    address_span: sourced ? `Demostrasse ${id.length}` : null,
    address_url: sourced ? `https://demo-${id}.example.test/contact` : null,
    address_fetched_at: sourced ? "2026-10-18T12:00:00Z" : null,
  };
}

describe("approximate distances on the map frame", () => {
  test("20 units is about 400 m", () => {
    expect(approximateMetres(ORIGIN, { x: 20, z: 0 })).toBe(400);
    expect(distanceLabel(approximateMetres(ORIGIN, { x: 12, z: -16 }))).toBe("about 400 m");
  });

  test("they round to the nearest 50 m, and the shortest say so instead of 0", () => {
    expect(approximateMetres(ORIGIN, { x: 12.3, z: 0 })).toBe(250);
    expect(approximateMetres(ORIGIN, { x: -101.4, z: 0 })).toBe(2050);
    expect(distanceLabel(2050)).toBe("about 2,050 m");
    expect(approximateMetres(ORIGIN, { x: 1.2, z: 0 })).toBe(0);
    expect(distanceLabel(0)).toBe("under 50 m");
  });
});

describe("nearbyPlaces", () => {
  test("the nearest sourced places, by rounded distance and then id", () => {
    const places = [
      place("far", 40, 0),
      place("zeta", 0, 10),
      place("alpha", 10.1, 0),
      place("no-address", 1, 0, false),
      place("beta", 0, -5),
    ];
    const nearby = nearbyPlaces(ORIGIN, places, 3);
    expect(nearby.map(({ id, metres }) => [id, metres])).toEqual([
      ["beta", 100],
      ["alpha", 200],
      ["zeta", 200],
    ]);
    expect(nearby[0]?.address).toEqual({
      span: "Demostrasse 4",
      url: "https://demo-beta.example.test/contact",
      fetchedAt: "2026-10-18T12:00:00Z",
    });
  });
});

describe("fetchedOn", () => {
  test("gives the day in Bern, which can be a day after UTC", () => {
    expect(fetchedOn("2026-10-18T12:32:41Z")).toBe("18 Oct 2026");
    expect(fetchedOn("2026-10-18T22:30:00Z")).toBe("19 Oct 2026");
  });
});
