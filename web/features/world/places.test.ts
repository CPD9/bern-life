import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildingKey, groupPlacesByBuilding } from "./buildings";
import { MAP_BOUNDS } from "./geography";
import { InvalidPlaceError, PLACES, parsePlaces, type Place, type PlaceKind } from "./places";

type SourceSite = { host: string; unit: string };
type SourceFile = { id: string; sites: SourceSite[] };

const SOURCES_DIR = join(import.meta.dir, "..", "..", "..", "sources");

function readSources(): SourceFile[] {
  return readdirSync(SOURCES_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(SOURCES_DIR, name), "utf8")) as SourceFile);
}

const INVENTED_ADDRESS = {
  address_url: "https://www.example-institute.test/contact",
  address_fetched_at: "2026-10-18T12:00:00Z",
  address_page_sha256: "a".repeat(64),
} as const;

function invented(
  id: string,
  address: string | null,
  x = 1,
  z = 2,
  kind: PlaceKind = "institute",
): Place {
  const common = {
    id,
    name: `Example unit ${id}`,
    source_id: "example",
    host: "www.example-institute.test",
    kind,
    x,
    z,
  } as const;
  if (address === null) {
    return {
      ...common,
      position_method: "district",
      address: null,
      address_url: null,
      address_span: null,
      address_fetched_at: null,
      address_page_sha256: null,
    };
  }
  return {
    ...common,
    ...INVENTED_ADDRESS,
    position_method: "address",
    address,
    address_span: address,
  };
}

describe("places.json against sources/", () => {
  const sites = readSources().flatMap((source) =>
    source.sites.map((site) => ({ ...site, sourceId: source.id })),
  );

  test("every source host has exactly one place and no place lacks a host", () => {
    const placeHosts = PLACES.map((place) => place.host).sort();
    expect(placeHosts).toEqual(sites.map((site) => site.host).sort());
    expect(new Set(placeHosts).size).toBe(22);
  });

  test("ids are unique and each place carries its unit name and source id", () => {
    expect(new Set(PLACES.map((place) => place.id)).size).toBe(PLACES.length);
    for (const site of sites) {
      const place = PLACES.find((candidate) => candidate.host === site.host);
      expect(place?.name).toBe(site.unit);
      expect(place?.source_id).toBe(site.sourceId);
    }
  });

  test("20 places stand at their address and 2 in their district", () => {
    const district = PLACES.filter((place) => place.position_method === "district");
    expect(district.map((place) => place.id)).toEqual(["mic", "strada"]);
    expect(PLACES.length - district.length).toBe(20);
  });

  test("an addressed place's address is its verbatim span", () => {
    for (const place of PLACES) {
      if (place.position_method === "address") expect(place.address).toBe(place.address_span);
    }
  });

  test("every place lies inside the map", () => {
    for (const place of PLACES) {
      expect(place.x).toBeGreaterThanOrEqual(MAP_BOUNDS.minX);
      expect(place.x).toBeLessThanOrEqual(MAP_BOUNDS.maxX);
      expect(place.z).toBeGreaterThanOrEqual(MAP_BOUNDS.minZ);
      expect(place.z).toBeLessThanOrEqual(MAP_BOUNDS.maxZ);
    }
  });

  test("three buildings hold two units each, and units in one building share a position", () => {
    const buildings = groupPlacesByBuilding(PLACES);
    expect(buildings.length).toBe(19);
    const shared = buildings
      .filter((building) => building.places.length > 1)
      .map((building) => building.places.map((place) => place.id));
    expect(shared).toEqual([
      ["iml", "ispm"],
      ["artorg", "neuroscience"],
      ["iap", "itp"],
    ]);
    for (const building of buildings) {
      for (const place of building.places)
        expect([place.x, place.z]).toEqual([building.x, building.z]);
    }
  });
});

describe("buildingKey", () => {
  test("finds the street and number however the page writes the address", () => {
    expect(buildingKey("Murtenstrasse 50, 3008 Bern")).toBe("murtenstrasse 50");
    expect(buildingKey("Murtenstrasse 50")).toBe("murtenstrasse 50");
    expect(buildingKey("Inselspital, INO-F; Rosenbühlgasse 27")).toBe("rosenbühlgasse 27");
    expect(buildingKey("Länggass-Strasse 120")).toBe("länggass-strasse 120");
    expect(buildingKey("Bremgartenstrasse 109a")).toBe("bremgartenstrasse 109a");
    expect(buildingKey("Gesellschaftsstrasse 6 (G6)")).toBe("gesellschaftsstrasse 6");
  });

  test("an address without a street and number, or none at all, has no key", () => {
    expect(buildingKey("Inselspital")).toBeNull();
    expect(buildingKey(null)).toBeNull();
  });
});

describe("groupPlacesByBuilding", () => {
  test("units at one building group, take the first unit's kind, others stand alone", () => {
    const buildings = groupPlacesByBuilding([
      invented("c-wing", "Inselspital, INO-F; Rosenbühlgasse 27", 7, 8),
      invented("b-short", "Murtenstrasse 50", 3, 4, "institute"),
      invented("a-long", "Murtenstrasse 50, 3008 Bern", 3, 4, "centre"),
      invented("d-district", null, 5, 6),
    ]);
    expect(
      buildings.map((building) => ({
        key: building.key,
        at: [building.x, building.z],
        kind: building.kind,
        ids: building.places.map((place) => place.id),
      })),
    ).toEqual([
      { key: "murtenstrasse 50", at: [3, 4], kind: "centre", ids: ["a-long", "b-short"] },
      { key: "place:d-district", at: [5, 6], kind: "institute", ids: ["d-district"] },
      { key: "rosenbühlgasse 27", at: [7, 8], kind: "institute", ids: ["c-wing"] },
    ]);
  });
});

describe("parsePlaces", () => {
  const valid = invented("a-long", "Murtenstrasse 50, 3008 Bern");

  test("accepts an addressed and a district place unchanged", () => {
    const district = invented("d-district", null);
    expect(parsePlaces([valid, district])).toEqual([valid, district]);
  });

  test("rejects each broken field by name", () => {
    const cases: [object, number, string][] = [
      [{ ...valid, kind: "museum" }, 0, "kind"],
      [{ ...valid, address_span: "" }, 0, "address_span"],
      [{ ...valid, address: "Bühlstrasse 26" }, 0, "address"],
      [{ ...valid, address_url: "https://www.elsewhere.test/contact" }, 0, "address_url"],
      [{ ...valid, address_url: "http://www.example-institute.test/contact" }, 0, "address_url"],
      [{ ...valid, address_page_sha256: "abc" }, 0, "address_page_sha256"],
      [{ ...valid, address_fetched_at: "yesterday" }, 0, "address_fetched_at"],
      [{ ...valid, position_method: "district" }, 0, "address"],
      [{ ...valid, position_method: "guessed" }, 0, "position_method"],
      [{ ...valid, x: Number.NaN }, 0, "x"],
    ];
    for (const [entry, index, field] of cases) {
      expect(() => parsePlaces([entry])).toThrow(new InvalidPlaceError(index, field));
    }
  });
});
