import { describe, expect, test } from "bun:test";
import type { EvalNumbers } from "@/infrastructure/numbers";
import { stepReading } from "./case-numbers";

/** Invented numbers in the evaluator's shape; nothing here was measured. */
const numbers: EvalNumbers = {
  queries: 48,
  recall_at_10: { value: 0.4375, low: 0.29, high: 0.58 },
  mrr: 0.31,
  invented_abstained: { n: 7, of: 10 },
  false_abstention: { n: 2, of: 38 },
  traceable: { n: 812, of: 812 },
  invented_entities: 0,
  slices: [
    { name: "lang:de", recall_at_10: 0.25 },
    { name: "source:unibe", recall_at_10: 0.4 },
    { name: "source:artorg", recall_at_10: { value: 0.5, low: 0.2, high: 0.8 } },
    { name: "source:dcb", recall_at_10: 0.45 },
    { name: "variant:site", recall_at_10: 0.6 },
    { name: "variant:synonym", recall_at_10: 0.5 },
    { name: "variant:lay", recall_at_10: 0.3 },
    { name: "variant:translation", recall_at_10: 0.35 },
    { name: "variant:invented", recall_at_10: 0 },
  ],
};

describe("stepReading", () => {
  test("the right people: recall against the case's 80% bar", () => {
    expect(stepReading("c1-right-people", numbers)).toEqual({
      rows: [{ label: "Recall@10", value: "0.4375 [0.29, 0.58]" }],
      verdict: { bar: "at least 0.8", met: false },
    });
    const met = stepReading("c1-right-people", {
      ...numbers,
      recall_at_10: { value: 0.8, low: 0.7, high: 0.9 },
    });
    expect(met?.verdict).toEqual({ bar: "at least 0.8", met: true });
  });

  test("wording: the recall of each wording slice, in the case's words, no bar", () => {
    expect(stepReading("c2-wording", numbers)).toEqual({
      rows: [
        { label: "Recall@10, the site's own words", value: "0.6" },
        { label: "Recall@10, synonyms", value: "0.5" },
        { label: "Recall@10, lay words", value: "0.3" },
        { label: "Recall@10, translations", value: "0.35" },
      ],
      verdict: null,
    });
  });

  test("traceable: every claim and no invented entity, else not met", () => {
    expect(stepReading("c3-traceable", numbers)).toEqual({
      rows: [
        { label: "Traceable claims", value: "812 / 812" },
        { label: "Invented entities", value: "0" },
      ],
      verdict: { bar: "every claim traceable and 0 invented", met: true },
    });
    expect(stepReading("c3-traceable", { ...numbers, invented_entities: 1 })?.verdict).toEqual({
      bar: "every claim traceable and 0 invented",
      met: false,
    });
    expect(
      stepReading("c3-traceable", { ...numbers, traceable: { n: 811, of: 812 } })?.verdict?.met,
    ).toBe(false);
  });

  test("sources: one row per institution slice", () => {
    expect(stepReading("c5-sources", numbers)).toEqual({
      rows: [
        { label: "Recall@10, University of Bern", value: "0.4" },
        { label: "Recall@10, ARTORG", value: "0.5 [0.2, 0.8]" },
        { label: "Recall@10, Diabetes Center Berne", value: "0.45" },
      ],
      verdict: null,
    });
  });

  test("the honest no: abstentions on invented questions and false abstentions", () => {
    expect(stepReading("ethics-abstain", numbers)).toEqual({
      rows: [
        { label: "Invented questions abstained", value: "7 / 10" },
        { label: "False abstentions", value: "2 / 38" },
      ],
      verdict: null,
    });
  });

  test("fields and extension are not measured by the evaluator", () => {
    expect(stepReading("c4-structured", numbers)).toBeNull();
    expect(stepReading("c6-extend", numbers)).toBeNull();
  });
});
