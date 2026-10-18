import { describe, expect, test } from "bun:test";
import { abstainedFixture, briefFixture, healthFixture, resultFixture } from "@/test/fixtures";
import { createFixtureClient } from "./fixture-client";

const client = createFixtureClient({
  result: resultFixture,
  abstained: abstainedFixture,
  brief: briefFixture,
  health: healthFixture,
});

describe("createFixtureClient", () => {
  test("a query sharing a word with the fixture or its expanded terms gets the result", async () => {
    expect(await client.search({ query: "Glucose" })).toEqual({ ok: true, value: resultFixture });
    expect(await client.search({ query: "CGM für Kinder" })).toEqual({
      ok: true,
      value: resultFixture,
    });
  });

  test("any other query gets the abstained fixture", async () => {
    expect(await client.search({ query: "quantum origami" })).toEqual({
      ok: true,
      value: abstainedFixture,
    });
  });

  test("a brief gets the brief fixture", async () => {
    expect(await client.brief("anything")).toEqual({ ok: true, value: briefFixture });
  });
});
