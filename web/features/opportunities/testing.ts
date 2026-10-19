// An invented funding call for the tests: the amount and the deadline sit inside their sentences,
// so a test can check that they are shown there and nowhere else.
import type { Claim, SearchResponse } from "@/infrastructure/contract-types.generated";
import type { SearchResult } from "@/infrastructure/claims";
import { copyOf, resultFixture } from "@/test/fixtures";

export const demoAmount = "CHF 150 000";
export const demoDeadline = "30 November 2026";

const page = "https://www.example-funder.test/calls/demo-seed-grant";
const sha = "0b5e2c3f0f1d4e8a9c7b6a5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b";

function claim(value: string, span: string): Claim {
  return {
    value,
    method: "selector",
    evidence: { page_url: page, page_sha256: sha, span, fetched_at: "2026-10-18T12:00:00Z" },
  };
}

export function callResult(): SearchResult {
  return {
    rank: 1,
    score: { fused: 0.5 },
    reason: { text: "The call funds early medtech projects.", cites: ["/fields/eligibility/0"] },
    profile: {
      id: "call-example-demo-seed-grant",
      kind: "call",
      source_id: "example",
      name: claim("Demo Seed Grant", "Demo Seed Grant"),
      source_url: page,
      fields: {
        role: [],
        unit: [],
        expertise: [],
        projects: [],
        infrastructure: [],
        services: [],
        funder: [claim("Example Funder", "Funded by the Example Funder.")],
        eligibility: [claim("early medtech projects", "Open to early medtech projects.")],
        amount: [claim(demoAmount, `Grants of up to ${demoAmount} per project.`)],
        deadline: [claim(demoDeadline, `Applications close on ${demoDeadline}.`)],
      },
    },
  };
}

/** The call and, after it, the contract fixture's person, as a proxy that ignores `kinds` sends. */
export function mixedResponse(): SearchResponse {
  const response = copyOf(resultFixture);
  const person = response.results[0];
  if (person === undefined) throw new Error("fixture has no result");
  response.results = [callResult(), { ...person, rank: 2 }];
  return response;
}
