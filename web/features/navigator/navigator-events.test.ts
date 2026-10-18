import { describe, expect, test } from "bun:test";
import { abstainedFixture, briefFixture, copyOf, resultFixture } from "@/test/fixtures";
import { answerEvents, asksInGermanOrFrench } from "./navigator-events";

describe("answerEvents", () => {
  test("a search with results is answered; German or French also counts as another language", () => {
    expect(
      answerEvents({ kind: "search", search: { query: "glucose sensors" } }, resultFixture),
    ).toEqual(["search_answered"]);
    expect(
      answerEvents(
        { kind: "search", search: { query: "Blutzucker messen bei Kindern" } },
        resultFixture,
      ),
    ).toEqual(["search_answered", "search_answered_other_language"]);
  });

  test("a brief with results, and an abstained answer, each give their own event", () => {
    expect(answerEvents({ kind: "brief" }, briefFixture)).toEqual(["brief_answered"]);
    expect(
      answerEvents({ kind: "search", search: { query: "Prof. Nobody" } }, abstainedFixture),
    ).toEqual(["abstained_seen"]);
  });

  test("an answer with no results, or abstained for another reason, gives none", () => {
    expect(
      answerEvents(
        { kind: "search", search: { query: "x" } },
        { ...copyOf(resultFixture), results: [] },
      ),
    ).toEqual([]);
    expect(
      answerEvents(
        { kind: "search", search: { query: "x" } },
        { ...copyOf(abstainedFixture), abstain_reason: "query_out_of_scope" },
      ),
    ).toEqual([]);
  });
});

describe("asksInGermanOrFrench", () => {
  test("the language picked, accented letters or de/fr words count; English does not", () => {
    expect(asksInGermanOrFrench({ query: "sensors", lang: "fr" })).toBe(true);
    expect(asksInGermanOrFrench({ query: "capteurs de glucose pour enfants" })).toBe(true);
    expect(asksInGermanOrFrench({ query: "Glukosesensoren für Kinder" })).toBe(true);
    expect(asksInGermanOrFrench({ query: "blood sugar sensor for children", lang: "en" })).toBe(
      false,
    );
  });
});
