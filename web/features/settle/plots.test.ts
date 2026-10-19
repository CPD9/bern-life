import { describe, expect, test } from "bun:test";
import { DISTRICTS } from "@/features/world/geography";
import { pointInPolygon } from "@/features/world/geometry";
import { PLOTS } from "./plots";

describe("PLOTS", () => {
  test("each plot stands inside the map district it is named after", () => {
    const misplaced = PLOTS.filter((plot) => {
      const district = DISTRICTS.find((candidate) => candidate.name === plot.district);
      return district === undefined || !pointInPolygon([plot.x, plot.z], district.outline);
    });
    expect(misplaced).toEqual([]);
    expect(PLOTS.map((plot) => plot.id)).toEqual([
      "altstadt",
      "laenggasse",
      "insel",
      "mattenhof",
      "liebefeld",
    ]);
  });
});
