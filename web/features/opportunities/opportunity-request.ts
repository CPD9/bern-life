// What the Opportunities app asks the search for, and which results it shows. Until the search
// proxy passes `kinds` through, the engine may answer with people and units too; the app shows only
// the kinds it asked for, in the engine's order and with the engine's ranks.
import type { Profile, SearchResponse } from "@/infrastructure/contract-types.generated";
import type { SearchResult } from "@/infrastructure/claims";

export type OpportunityKind = Extract<Profile["kind"], "call" | "service" | "space">;

export const opportunityKinds: readonly OpportunityKind[] = ["call", "service", "space"];

export const maxOpportunityQueryLength = 500;

export type OpportunityRequest = {
  readonly query: string;
  readonly kinds: readonly OpportunityKind[];
};

/** The body for `POST /api/search`, or null when the query is empty or too long to send. */
export function opportunityRequest(query: string): OpportunityRequest | null {
  const trimmed = query.trim();
  if (trimmed === "" || trimmed.length > maxOpportunityQueryLength) return null;
  return { query: trimmed, kinds: opportunityKinds };
}

export function isOpportunity(result: SearchResult): boolean {
  return opportunityKinds.some((kind) => kind === result.profile.kind);
}

export function opportunityResults(response: SearchResponse): SearchResult[] {
  return response.results.filter(isOpportunity);
}

/** Questions to start from. They name what to look for and claim nothing about what exists. */
export const starterQueries: readonly string[] = [
  "Funding for a medtech startup",
  "Support for founding a company in Bern",
  "Lab or office space for a small team",
];
