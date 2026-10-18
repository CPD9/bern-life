import { describe, expect, mock, test } from "bun:test";
import { parseSearchResponse } from "@/infrastructure/contract";
import { groupPlacesByBuilding } from "./buildings";
import { frameBox } from "./camera-moves";
import searchGlucose from "./fixtures/search-glucose.json";
import { lightUp, rankToGlow } from "./light";
import { PLACES } from "./places";
import { summaryText } from "./search-summary";
import { createWorldSearch } from "./world-search";

const fixture = parseSearchResponse(searchGlucose);

describe("the world fixture", () => {
  test("is a valid search response marked as a fixture", () => {
    expect(fixture).not.toBeNull();
    expect(fixture?.versions.snapshot).toBe("fixture");
    expect(
      fixture?.results.every((r) => new URL(r.profile.source_url).pathname.startsWith("/fixture/")),
    ).toBe(true);
  });
});

describe("rankToGlow", () => {
  test("steps down by rank to a floor", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 50].map(rankToGlow)).toEqual([
      1, 0.85, 0.7, 0.55, 0.4, 0.3, 0.3, 0.3,
    ]);
  });
});

describe("lightUp", () => {
  test("groups results by the building of their host, best rank first, the rest elsewhere", () => {
    if (fixture === null) throw new Error("fixture does not parse");
    const lighting = lightUp(fixture, groupPlacesByBuilding(PLACES));
    expect(
      [...lighting.byBuilding].map(([key, light]) => ({
        key,
        bestRank: light.bestRank,
        glow: light.glow,
        names: light.results.map((r) => r.profile.name.value),
      })),
    ).toEqual([
      { key: "freiburgstrasse 3", bestRank: 1, glow: 1, names: ["Ada Muster"] },
      { key: "murtenstrasse 50", bestRank: 2, glow: 0.85, names: ["Beat Beispiel", "Dora Demo"] },
      { key: "bühlstrasse 28", bestRank: 3, glow: 0.7, names: ["Carla Exempel"] },
    ]);
    expect(lighting.elsewhere.map((r) => r.profile.name.value)).toEqual(["Emil Exempel"]);
  });

  test("a response with no results lights nothing", () => {
    if (fixture === null) throw new Error("fixture does not parse");
    const lighting = lightUp({ ...fixture, results: [] }, groupPlacesByBuilding(PLACES));
    expect(lighting.byBuilding.size).toBe(0);
    expect(lighting.elsewhere).toEqual([]);
  });
});

describe("worldSearch store", () => {
  test("begin, showResults and clear move through the states and notify", () => {
    if (fixture === null) throw new Error("fixture does not parse");
    const store = createWorldSearch();
    const listener = mock(() => undefined);
    const unsubscribe = store.subscribe(listener);
    expect(store.read()).toEqual({ status: "idle" });
    store.begin();
    expect(store.read()).toEqual({ status: "searching" });
    store.showResults(fixture);
    expect(store.read()).toEqual({ status: "results", response: fixture });
    store.clear();
    expect(store.read()).toEqual({ status: "idle" });
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    store.begin();
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe("frameBox", () => {
  test("surrounds the points with a margin, and never shrinks below a minimum span", () => {
    expect(
      frameBox(
        [
          [0, 0],
          [20, -10],
        ],
        4,
        10,
      ),
    ).toEqual({ minX: -4, maxX: 24, minZ: -14, maxZ: 4 });
    expect(frameBox([[5, 5]], 4, 30)).toEqual({ minX: -10, maxX: 20, minZ: -10, maxZ: 20 });
  });
});

describe("summaryText", () => {
  test("says what the light means in each state", () => {
    if (fixture === null) throw new Error("fixture does not parse");
    const lighting = lightUp(fixture, groupPlacesByBuilding(PLACES));
    expect(summaryText({ status: "idle" }, null)).toBeNull();
    expect(summaryText({ status: "searching" }, null)).toBe("Searching…");
    expect(summaryText({ status: "results", response: fixture }, lighting)).toBe(
      "4 matches at 3 places · 1 not on the map",
    );
    expect(
      summaryText(
        { status: "results", response: { ...fixture, abstained: true, results: [] } },
        null,
      ),
    ).toBe("No verifiable source for this search");
  });
});
