// DEMO_FIXTURES=1 serves the invented fixtures from contracts/fixtures/ instead of the engine. A
// query sharing a word with the fixture query or its expanded terms gets the result fixture;
// anything else gets the abstained one, so both states can be shown on purpose.
import type { Health, SearchResponse } from "./contract-types.generated";
import type { EngineClient } from "./engine-types";
import { contentWords } from "./text-match";

export type Fixtures = {
  readonly result: SearchResponse;
  readonly abstained: SearchResponse;
  readonly brief: SearchResponse;
  readonly health: Health;
};

export function createFixtureClient(fixtures: Fixtures): EngineClient {
  const known = new Set(
    contentWords(
      [fixtures.result.query, ...fixtures.result.expanded_terms.map((t) => t.term)].join(" "),
    ),
  );

  return {
    search: async ({ query }) => {
      const matches = contentWords(query).some((word) => known.has(word));
      return { ok: true, value: matches ? fixtures.result : fixtures.abstained };
    },
    brief: async () => ({ ok: true, value: fixtures.brief }),
    health: async () => ({ ok: true, value: fixtures.health }),
  };
}
