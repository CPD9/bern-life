import { describe, expect, test } from "bun:test";
import adminActivity from "../../contracts/fixtures/admin-activity.json";
import adminFlagged from "../../contracts/fixtures/admin-flagged.json";
import agent from "../../contracts/fixtures/agent.json";
import numbers from "../../contracts/fixtures/numbers.json";
import placePeople from "../../contracts/fixtures/place-people.json";
import opportunities from "../../contracts/fixtures/result-opportunities.json";
import sources from "../../contracts/fixtures/sources.json";
import { abstainedFixture, briefFixture, healthFixture, resultFixture } from "@/test/fixtures";
import {
  parseAdminActivity,
  parseAdminFlagged,
  parseAgentReply,
  parseNumbers,
  parsePlacePeople,
  parseSearchResponse,
  parseSourcesList,
} from "./contract";
import { createFixtureClient } from "./fixture-client";

function parsed<T>(value: T | null): T {
  if (value === null) throw new Error("fixture does not match its schema");
  return value;
}

const opportunitiesFixture = parsed(parseSearchResponse(opportunities));
const agentFixture = parsed(parseAgentReply(agent));
const sourcesFixture = parsed(parseSourcesList(sources));
const numbersFixture = parsed(parseNumbers(numbers));

const client = createFixtureClient({
  result: resultFixture,
  abstained: abstainedFixture,
  opportunities: opportunitiesFixture,
  brief: briefFixture,
  agent: agentFixture,
  sources: sourcesFixture,
  numbers: numbersFixture,
  placePeople: parsed(parsePlacePeople(placePeople)),
  health: healthFixture,
  adminActivity: parsed(parseAdminActivity(adminActivity)),
  adminFlagged: parsed(parseAdminFlagged(adminFlagged)),
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

  test("a search for calls, services or spaces only gets the opportunities", async () => {
    expect(
      await client.search({ query: "seed grant", kinds: ["call", "service", "space"] }),
    ).toEqual({ ok: true, value: opportunitiesFixture });
    expect(await client.search({ query: "lab bench", kinds: ["space"] })).toEqual({
      ok: true,
      value: opportunitiesFixture,
    });
  });

  test("a search that also asks for people is matched as before", async () => {
    expect(await client.search({ query: "glucose", kinds: ["call", "person"] })).toEqual({
      ok: true,
      value: resultFixture,
    });
    expect(await client.search({ query: "quantum origami", kinds: [] })).toEqual({
      ok: true,
      value: abstainedFixture,
    });
  });

  test("a brief gets the brief fixture", async () => {
    expect(await client.brief("anything")).toEqual({ ok: true, value: briefFixture });
  });

  test("the agent, sources and numbers get their fixtures", async () => {
    const messages = [{ role: "user", content: "Who works on glucose sensors?" }] as const;
    expect(await client.agent({ messages })).toEqual({ ok: true, value: agentFixture });
    expect(await client.sources()).toEqual({ ok: true, value: sourcesFixture });
    expect(await client.numbers()).toEqual({ ok: true, value: numbersFixture });
  });
});
