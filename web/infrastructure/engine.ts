// Chooses the engine or the fixtures once per server process. Imported only by route handlers
// and server components, so the engine URL never reaches the browser.
import adminActivityFixture from "../../contracts/fixtures/admin-activity.json";
import adminFlaggedFixture from "../../contracts/fixtures/admin-flagged.json";
import agentFixture from "../../contracts/fixtures/agent.json";
import healthFixture from "../../contracts/fixtures/health.json";
import numbersFixture from "../../contracts/fixtures/numbers.json";
import abstainedFixture from "../../contracts/fixtures/result-abstained.json";
import briefFixture from "../../contracts/fixtures/result-brief.json";
import placePeopleFixture from "../../contracts/fixtures/place-people.json";
import opportunitiesFixture from "../../contracts/fixtures/result-opportunities.json";
import resultFixture from "../../contracts/fixtures/result.json";
import sourcesFixture from "../../contracts/fixtures/sources.json";
import {
  parseAdminActivity,
  parseAdminFlagged,
  parseAgentReply,
  parseHealth,
  parseNumbers,
  parsePlacePeople,
  parseSearchResponse,
  parseSourcesList,
} from "./contract";
import { createEngineClient } from "./engine-client";
import type { EngineClient } from "./engine-types";
import { env } from "./env";
import { createFixtureClient } from "./fixture-client";

const engineTimeoutMs = 60_000;

function required<T>(value: T | null, name: string): T {
  if (value === null) throw new Error(`contracts/fixtures/${name} does not match its schema`);
  return value;
}

function fixtureClient(): EngineClient {
  return createFixtureClient({
    result: required(parseSearchResponse(resultFixture), "result.json"),
    abstained: required(parseSearchResponse(abstainedFixture), "result-abstained.json"),
    opportunities: required(parseSearchResponse(opportunitiesFixture), "result-opportunities.json"),
    brief: required(parseSearchResponse(briefFixture), "result-brief.json"),
    agent: required(parseAgentReply(agentFixture), "agent.json"),
    sources: required(parseSourcesList(sourcesFixture), "sources.json"),
    numbers: required(parseNumbers(numbersFixture), "numbers.json"),
    placePeople: required(parsePlacePeople(placePeopleFixture), "place-people.json"),
    health: required(parseHealth(healthFixture), "health.json"),
    adminActivity: required(parseAdminActivity(adminActivityFixture), "admin-activity.json"),
    adminFlagged: required(parseAdminFlagged(adminFlaggedFixture), "admin-flagged.json"),
  });
}

let client: EngineClient | undefined;

export function engine(): EngineClient {
  if (client) return client;
  const config = env();
  client = config.demoFixtures
    ? fixtureClient()
    : createEngineClient({
        baseUrl: config.engineUrl,
        fetch: (url, init) => fetch(url, init),
        logError: (message, cause) => console.error(message, cause ?? ""),
        timeoutMs: engineTimeoutMs,
      });
  return client;
}
