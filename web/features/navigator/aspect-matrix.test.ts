import { describe, expect, test } from "bun:test";
import { briefFixture, resultFixture } from "@/test/fixtures";
import { aspectMatrix, coverage } from "./aspect-matrix";

describe("aspectMatrix", () => {
  test("two-need brief: one need covered, one only partly, the gap is reported", () => {
    const matrix = aspectMatrix(briefFixture);
    expect(matrix?.rows).toEqual([
      { rank: 1, name: "Ada Muster", cells: ["covered", "none"] },
      { rank: 2, name: "Beat Beispiel", cells: ["none", "partial"] },
    ]);
    expect(matrix?.gaps).toEqual([
      {
        need: {
          term: "clinical data analysis",
          span: "We need a partner for clinical data analysis of sensor time series.",
        },
        best: "partial",
      },
    ]);
  });

  test("a plain query has no matrix", () => {
    expect(aspectMatrix(resultFixture)).toBeNull();
  });
});

describe("coverage", () => {
  test("ignores case, accents and filler words", () => {
    expect(coverage("Messung für Kinder", "messung bei kindern")).toBe("covered");
    expect(coverage("the sensor and the pump", "sensor")).toBe("partial");
    expect(coverage("pump", "sensor")).toBe("none");
  });
});
