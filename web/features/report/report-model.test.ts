import { describe, expect, test } from "bun:test";
import { abstainedFixture, briefFixture, copyOf, resultFixture } from "@/test/fixtures";
import { buildReport } from "./report-model";

const madeAt = "2026-10-18T19:30:00Z";

describe("buildReport", () => {
  test("a search answer becomes a report with chips, proof and metrics from the response", () => {
    const report = buildReport(resultFixture, madeAt, true)!;
    expect(report.topics).toEqual(["glucose sensors"]);
    expect(report.addedWordings.map((wording) => wording.term)).toEqual([
      "continuous glucose monitoring",
      "CGM",
      "Blutzuckersensor",
    ]);
    expect(report.modeLabels).toEqual(["MOCK", "FIXTURE"]);
    expect(report.snapshot).toBe("fixture");
    expect(report.cards).toHaveLength(1);
    expect(report.cards[0]).toMatchObject({
      rank: 1,
      name: "Ada Muster",
      role: "Group Leader",
      unit: "Sensor Lab",
      novelty: ["New unit", "Adds: glucose sensors"],
      covers: ["glucose sensors"],
      missing: [],
      proof: {
        span: "continuous glucose monitoring",
        pageUrl: "https://www.example-institute.test/team/ada-muster",
        fetchedAt: "2026-10-18T12:00:00Z",
      },
      relevance: "100%",
      evidence: "100%",
      completeness: "5 of 5",
      confidence: "not yet calibrated",
    });
  });

  test("chips are exactly the metrics' covers and missing", () => {
    const response = copyOf(resultFixture);
    response.results[0]!.metrics!.covers = ["glucose sensors"];
    response.results[0]!.metrics!.missing = ["children", "wearables"];
    const card = buildReport(response, madeAt, false)!.cards[0]!;
    expect(card.covers).toEqual(["glucose sensors"]);
    expect(card.missing).toEqual(["children", "wearables"]);
  });

  test("a value that could not be computed is a dash, never zero", () => {
    const response = copyOf(resultFixture);
    response.results[0]!.metrics!.relevance = null;
    response.results[0]!.metrics!.evidence = null;
    const card = buildReport(response, madeAt, false)!.cards[0]!;
    expect([card.relevance, card.evidence]).toEqual(["—", "—"]);
  });

  test("a result without metrics shows dashes and no chips or novelty", () => {
    const card = buildReport(briefFixture, madeAt, false)!.cards[1]!;
    expect(card).toMatchObject({
      name: "Beat Beispiel",
      covers: [],
      missing: [],
      novelty: [],
      relevance: "—",
      evidence: "—",
      completeness: "—",
      confidence: "—",
    });
    expect(card.details).toEqual([
      { label: "Projects", value: "—" },
      { label: "Infrastructure", value: "—" },
      { label: "Services", value: "data analysis consulting for industry partners" },
    ]);
  });

  test("a brief keeps each need with its sentence", () => {
    expect(buildReport(briefFixture, madeAt, false)!.needs.map((need) => need.term)).toEqual([
      "wearable glucose sensor",
      "clinical data analysis",
    ]);
  });

  test("abstained or empty answers give no report", () => {
    expect(buildReport(abstainedFixture, madeAt, false)).toBeNull();
    expect(buildReport({ ...copyOf(resultFixture), results: [] }, madeAt, false)).toBeNull();
  });
});
