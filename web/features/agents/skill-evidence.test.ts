import { describe, expect, test } from "bun:test";
import { parseNumbers } from "@/infrastructure/numbers";
import type { NumbersState } from "@/infrastructure/use-numbers";
import { numbersBody } from "@/test/numbers";
import { redTeamResults } from "./red-team-results";
import { NO_EVIDENCE, skillEvidence } from "./skill-evidence";
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

const quoted = redTeamResults.map((row) => ({ ...row, fixture: false }));

describe("skillEvidence", () => {
  test("the red-team results are quoted exactly as the cited files give them", () => {
    expect(redTeamResults.map((row) => row.value)).toEqual(["152 / 522 to 63 / 522", "15 / 18"]);
    expect(redTeamResults.every((row) => row.source.href === undefined)).toBe(true);
  });

  test("measured rows are the evaluator's values as sent, before the quoted ones", () => {
    const body = numbersBody();
    const single = ok({ ...body, eval: { ...body.eval, queries: 1 } });
    const source = {
      name: "Bern Life’s evaluator on snapshot demo-snapshot-1, 1 query",
      href: "/api/numbers",
    };
    expect(skillEvidence(skill("premise"), single, false)).toEqual({
      rows: [
        { label: "Invented questions abstained", value: "7 / 10", source, fixture: false },
        { label: "False abstentions", value: "2 / 38", source, fixture: false },
        ...quoted,
      ],
      note: null,
    });
  });

  test("while the numbers are missing only the quoted rows show, with a note saying why", () => {
    const states: [NumbersState, string][] = [
      [{ status: "loading" }, "Loading Bern Life’s numbers."],
      [{ status: "not_connected" }, "Bern Life’s numbers are not connected yet."],
      [{ status: "error" }, "Bern Life’s numbers could not be loaded."],
      [ok({ ...numbersBody(), eval: null }), "The evaluator has not run on this snapshot."],
    ];
    for (const [state, note] of states) {
      expect(skillEvidence(skill("premise"), state, false)).toEqual({ rows: quoted, note });
      expect(skillEvidence(skill("navigator"), state, true)).toEqual({ rows: [], note });
    }
  });

  test("a skill with nothing to cite has no rows, whatever the numbers", () => {
    for (const id of ["brief", "report", "opportunities"] as const) {
      expect(skillEvidence(skill(id), ok(numbersBody()), false)).toEqual({
        rows: [],
        note: NO_EVIDENCE,
      });
    }
  });
});
