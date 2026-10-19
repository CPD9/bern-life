// DEMO_FIXTURES=1 serves the invented fixtures from contracts/fixtures/ instead of the engine. A
// search for opportunities only (calls, services, spaces) gets the opportunities fixture. Any other
// query sharing a word with the fixture query or its expanded terms gets the result fixture;
// anything else gets the abstained one, so both states can be shown on purpose.
import type {
  AgentReply,
  Health,
  Numbers,
  PlacePeople,
  SearchResponse,
  SourcesList,
} from "./contract-types.generated";
import type { EngineClient, ProfileKind } from "./engine-types";
import { contentWords } from "./text-match";

export type Fixtures = {
  readonly result: SearchResponse;
  readonly abstained: SearchResponse;
  readonly opportunities: SearchResponse;
  readonly brief: SearchResponse;
  readonly agent: AgentReply;
  readonly sources: SourcesList;
  readonly placePeople: PlacePeople;
  readonly numbers: Numbers;
  readonly health: Health;
};

const opportunityKinds: readonly ProfileKind[] = ["call", "service", "space"];

function onlyOpportunities(kinds: readonly ProfileKind[] | undefined): boolean {
  return (
    kinds !== undefined &&
    kinds.length > 0 &&
    kinds.every((kind) => opportunityKinds.includes(kind))
  );
}

export function createFixtureClient(fixtures: Fixtures): EngineClient {
  const known = new Set(
    contentWords(
      [fixtures.result.query, ...fixtures.result.expanded_terms.map((t) => t.term)].join(" "),
    ),
  );

  return {
    search: async ({ query, kinds }) => {
      if (onlyOpportunities(kinds)) return { ok: true, value: fixtures.opportunities };
      const matches = contentWords(query).some((word) => known.has(word));
      return { ok: true, value: matches ? fixtures.result : fixtures.abstained };
    },
    brief: async () => ({ ok: true, value: fixtures.brief }),
    agent: async () => ({ ok: true, value: fixtures.agent }),
    sources: async () => ({ ok: true, value: fixtures.sources }),
    placePeople: async () => ({ ok: true, value: fixtures.placePeople }),
    numbers: async () => ({ ok: true, value: fixtures.numbers }),
    health: async () => ({ ok: true, value: fixtures.health }),
  };
}
