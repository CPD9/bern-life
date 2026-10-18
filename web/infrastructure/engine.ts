// Chooses the engine or the fixtures once per server process. Imported only by route handlers
// and server components, so the engine URL never reaches the browser.
import abstainedFixture from "../../contracts/fixtures/result-abstained.json";
import briefFixture from "../../contracts/fixtures/result-brief.json";
import healthFixture from "../../contracts/fixtures/health.json";
import resultFixture from "../../contracts/fixtures/result.json";
import { parseHealth, parseSearchResponse } from "./contract";
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
    brief: required(parseSearchResponse(briefFixture), "result-brief.json"),
    health: required(parseHealth(healthFixture), "health.json"),
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
