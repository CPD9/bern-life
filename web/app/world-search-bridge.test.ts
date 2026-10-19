import { describe, expect, test } from "bun:test";
import { groupPlacesByBuilding } from "@/features/world/buildings";
import { PLACES } from "@/features/world/places";
import { createWorldSearch } from "@/features/world/world-search";
import { resultFixture } from "@/test/fixtures";
import { applyWorldAction, searchHereDraft, worldActionFor } from "./world-search-bridge";

const search = { kind: "search", search: { query: "glucose sensors" } } as const;

describe("worldActionFor", () => {
  test("maps each Navigator state to what the map should do", () => {
    expect(worldActionFor({ status: "idle" })).toBeNull();
    expect(worldActionFor({ status: "loading", request: search })).toEqual({ kind: "begin" });
    expect(worldActionFor({ status: "done", request: search, response: resultFixture })).toEqual({
      kind: "show",
      response: resultFixture,
    });
    expect(
      worldActionFor({ status: "failed", request: search, failure: { kind: "network" } }),
    ).toEqual({ kind: "clear" });
  });
});

describe("applyWorldAction", () => {
  test("drives the world store, and nothing leaves it as it was", () => {
    const world = createWorldSearch();
    applyWorldAction(null, world);
    expect(world.read()).toEqual({ status: "idle" });
    applyWorldAction({ kind: "begin" }, world);
    expect(world.read()).toEqual({ status: "searching" });
    applyWorldAction({ kind: "show", response: resultFixture }, world);
    expect(world.read()).toEqual({ status: "results", response: resultFixture });
    applyWorldAction(null, world);
    expect(world.read()).toEqual({ status: "results", response: resultFixture });
    applyWorldAction({ kind: "clear" }, world);
    expect(world.read()).toEqual({ status: "idle" });
  });
});

describe("searchHereDraft", () => {
  test("names every unit in the building, ready for a topic", () => {
    const building = groupPlacesByBuilding(PLACES).find((b) => b.key === "murtenstrasse 50");
    if (building === undefined) throw new Error("places changed");
    expect(searchHereDraft(building)).toBe(
      "ARTORG Center for Biomedical Engineering Research · Clinical Neuroscience Bern: ",
    );
  });
});
