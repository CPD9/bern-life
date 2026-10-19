import { describe, expect, test } from "bun:test";
import { parseNumbers } from "@/infrastructure/numbers";
import type { NumbersState } from "@/infrastructure/use-numbers";
import { numbersBody } from "@/test/numbers";
import { skillEvidence } from "./skill-evidence";
import { type SkillId, skills } from "./skills";

function skill(id: SkillId) {
  const found = skills.find((entry) => entry.id === id);
  if (!found) throw new Error(`no skill ${id}`);
  return found;
}

function ok(body: unknown): NumbersState {
  const numbers = parseNumbers(body);
  if (!numbers) throw new Error("test body does not parse");
  return { status: "ok", numbers };
}

describe("skillEvidence", () => {
  test("each cited number is the evaluator's value as sent, with its snapshot and a link", () => {
    const body = numbersBody();
    const single = ok({ ...body, eval: { ...body.eval, queries: 1 } });
    const source = {
      name: "Bern Life’s evaluator on snapshot demo-snapshot-1, 1 query",
      href: "/api/numbers",
    };
    expect(skillEvidence(skill("premise"), single, false)).toEqual([
      { label: "Invented questions abstained", value: "7 / 10", source, fixture: false },
      { label: "False abstentions", value: "2 / 38", source, fixture: false },
    ]);
  });

  test("under fixtures every row is marked FIXTURE and never named the evaluator's", () => {
    const source = {
      name: "Invented for the demo (DEMO_FIXTURES), not from the evaluator",
      href: "/api/numbers",
    };
    expect(skillEvidence(skill("navigator"), ok(numbersBody()), true)).toEqual([
      { label: "Recall@10", value: "0.4375 [0.29, 0.58]", source, fixture: true },
      { label: "Traceable claims", value: "812 / 812", source, fixture: true },
    ]);
  });

  test("while the numbers are missing no row is guessed", () => {
    const states: NumbersState[] = [
      { status: "loading" },
      { status: "not_connected" },
      { status: "error" },
      ok({ ...numbersBody(), eval: null }),
    ];
    for (const state of states) {
      expect(skillEvidence(skill("premise"), state, false)).toEqual([]);
      expect(skillEvidence(skill("navigator"), state, true)).toEqual([]);
    }
  });

  test("a skill with nothing to cite has no rows, whatever the numbers", () => {
    for (const id of ["brief", "report", "opportunities"] as const) {
      expect(skillEvidence(skill(id), ok(numbersBody()), false)).toEqual([]);
    }
  });
});
