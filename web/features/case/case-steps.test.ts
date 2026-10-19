import { describe, expect, test } from "bun:test";
import {
  alarmQuestion,
  caseStepAppId,
  caseSteps,
  inventedQuestion,
  stepAfter,
  stepBefore,
} from "./case-steps";

describe("case steps", () => {
  test("seven steps, numbered in the case's order, each its own app", () => {
    expect(caseSteps.map((step) => [step.number, step.label, step.criterion])).toEqual([
      [1, "1 People", "c1-right-people"],
      [2, "2 Wording", "c2-wording"],
      [3, "3 Proof", "c3-traceable"],
      [4, "4 Fields", "c4-structured"],
      [5, "5 Sources", "c5-sources"],
      [6, "6 Add a site", "c6-extend"],
      [7, "7 Honest no", "ethics-abstain"],
    ]);
    expect(caseSteps.map(caseStepAppId)).toEqual([
      "case-1",
      "case-2",
      "case-3",
      "case-4",
      "case-5",
      "case-6",
      "case-7",
    ]);
  });

  test("Try it runs the recorded questions, and step 6 opens Sources", () => {
    expect(caseSteps.map((step) => step.action)).toEqual([
      { kind: "ask", query: alarmQuestion, then: [] },
      { kind: "ask", query: "glucose sensors", then: ["CGM", "Blutzucker messen"] },
      { kind: "ask", query: alarmQuestion, then: [] },
      { kind: "ask", query: alarmQuestion, then: [] },
      { kind: "ask", query: alarmQuestion, then: [] },
      { kind: "open", appId: "sources" },
      { kind: "ask", query: inventedQuestion, then: [] },
    ]);
    expect(alarmQuestion).toBe(
      "Is anyone in Bern building an alarm that detects low blood sugar at night in elderly people in care homes?",
    );
    expect(inventedQuestion).toBe(
      "Results of the ALPENHITZE cohort study led by Prof. Beat Zurbriggen at ISPM",
    );
  });

  test("every step says what the case asks and what to look for", () => {
    for (const step of caseSteps) {
      expect(step.asks.length).toBeGreaterThan(20);
      expect(step.lookFor.length).toBeGreaterThanOrEqual(1);
      expect(step.lookFor.length).toBeLessThanOrEqual(2);
    }
  });

  test("Next and Back walk the sequence and stop at its ends", () => {
    const [first, second] = caseSteps;
    const last = caseSteps[6]!;
    expect(stepBefore(first!)).toBeNull();
    expect(stepAfter(first!)).toBe(second!);
    expect(stepBefore(second!)).toBe(first!);
    expect(stepAfter(last)).toBeNull();
    expect(stepBefore(last)?.label).toBe("6 Add a site");
  });
});
