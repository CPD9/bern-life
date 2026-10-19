import { describe, expect, test } from "bun:test";
import {
  answerSourceFor,
  answerSourceForHealth,
  howAnAnswerIsMade,
  offlineSource,
  sampleDataBanner,
} from "./answer-source";

describe("answerSourceFor", () => {
  test("every mode gets a plain label and sentence; only sample data and offline warn", () => {
    expect(answerSourceFor("live", false)).toMatchObject({
      label: "Live",
      sentence: "Apertus added search terms and explanations just now.",
      tone: "quiet",
    });
    expect(answerSourceFor("replay", false)).toMatchObject({
      label: "Recorded",
      sentence:
        "Apertus's search terms for this question were recorded earlier; the search itself ran just now over the stored pages.",
      tone: "quiet",
    });
    expect(answerSourceFor("mock", false)).toMatchObject({
      label: "Your words only",
      sentence:
        "No recorded Apertus terms exist for this wording, so the search used your words alone. Every result still comes from a stored page.",
      tone: "quiet",
    });
    expect(answerSourceFor("mock", true)).toMatchObject({
      label: "Sample data",
      sentence: "These results are invented sample data, not pages.",
      tone: "warn",
    });
    expect(offlineSource).toMatchObject({
      label: "Offline",
      sentence: "The search service is not reachable.",
      tone: "warn",
    });
  });

  test("the fixture flag wins over any mode", () => {
    expect(answerSourceFor("live", true).label).toBe("Sample data");
    expect(answerSourceFor("replay", true).label).toBe("Sample data");
  });

  test("no visitor-facing text uses the engine's words", () => {
    const texts = (["live", "replay", "mock"] as const).flatMap((mode) =>
      [answerSourceFor(mode, false), answerSourceFor(mode, true), offlineSource].flatMap(
        (source) => [source.label, source.sentence, source.explanation],
      ),
    );
    for (const text of [...texts, sampleDataBanner, ...howAnAnswerIsMade]) {
      expect(text).not.toMatch(/replay|mock|fixture|engine|backend|cache/i);
    }
  });
});

describe("answerSourceForHealth", () => {
  const ok = (mode: "live" | "replay" | "mock", snapshot: string) =>
    ({ status: "ok", health: { mode, snapshot } }) as const;

  test("nothing while health is unknown, Offline when it is down", () => {
    expect(answerSourceForHealth(undefined, false)).toBeNull();
    expect(answerSourceForHealth({ status: "waiting" }, false)).toBeNull();
    expect(answerSourceForHealth({ status: "offline" }, false)?.label).toBe("Offline");
  });

  test("the fixture snapshot or fixture mode is sample data; otherwise the mode decides", () => {
    expect(answerSourceForHealth(ok("mock", "2026-10-18"), false)?.label).toBe("Your words only");
    expect(answerSourceForHealth(ok("mock", "fixture"), false)?.label).toBe("Sample data");
    expect(answerSourceForHealth(ok("replay", "2026-10-18"), true)?.label).toBe("Sample data");
    expect(answerSourceForHealth(ok("replay", "2026-10-18"), false)?.label).toBe("Recorded");
    expect(answerSourceForHealth(ok("live", "2026-10-18"), false)?.label).toBe("Live");
  });
});
