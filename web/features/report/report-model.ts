// Turns a search or brief response into the match report, following docs/match-report-design.md
// and docs/metrics.md. Pure: the report is built from the response already on screen, never from
// a new model call. Metrics describe a result and are never used to reorder it.
import { type ClaimRef, type SearchResult, citedClaims } from "@/infrastructure/claims";
import type { Profile, SearchResponse } from "@/infrastructure/contract-types.generated";
import { foldText } from "@/infrastructure/text-match";

export const notComputed = "—";

export type BriefNeed = NonNullable<SearchResponse["brief_terms"]>[number];

export type ReportProof = {
  readonly span: string;
  readonly pageUrl: string;
  readonly fetchedAt: string | null;
};

export type ReportCard = {
  readonly rank: number;
  readonly kind: Profile["kind"];
  readonly name: string;
  readonly role: string;
  readonly unit: string;
  readonly novelty: string[];
  readonly covers: string[];
  readonly missing: string[];
  readonly proof: ReportProof | null;
  readonly relevance: string;
  readonly evidence: string;
  readonly completeness: string;
  readonly confidence: string;
  readonly details: { label: string; value: string }[];
  readonly sourceUrl: string;
};

export type MatchReport = {
  readonly query: string;
  readonly needs: BriefNeed[];
  readonly topics: string[];
  readonly addedWordings: SearchResponse["expanded_terms"];
  readonly highlightTerms: string[];
  readonly cards: ReportCard[];
  readonly modeLabels: string[];
  readonly snapshot: string;
  readonly madeAt: string;
};

const modeLabel: Record<SearchResponse["mode"], string> = {
  live: "Live",
  replay: "Replay",
  mock: "MOCK",
};

function percent(value: number | null): string {
  return value === null ? notComputed : `${Math.round(value * 100)}%`;
}

function firstValue(profile: Profile, field: "role" | "unit"): string {
  return profile.fields[field][0]?.value ?? notComputed;
}

function joined(profile: Profile, field: "projects" | "infrastructure" | "services"): string {
  const values = profile.fields[field].map((claim) => claim.value);
  return values.length > 0 ? values.join(", ") : notComputed;
}

function novelty(result: SearchResult): string[] {
  const metrics = result.metrics;
  if (!metrics) return [];
  const tags = [metrics.novelty.new_unit ? "New unit" : "Unit already above"];
  if (metrics.novelty.adds.length > 0) tags.push(`Adds: ${metrics.novelty.adds.join(", ")}`);
  return tags;
}

/** The cited claim whose sentence names a topic or an added wording; else the first one cited. */
function proofClaim(result: SearchResult, terms: readonly string[]): ClaimRef | null {
  const cited = citedClaims(result).filter(({ pointer }) => pointer !== "/name");
  const folded = terms.map(foldText);
  const naming = cited.find(({ claim }) =>
    folded.some((term) => foldText(claim.evidence.span).includes(term)),
  );
  return naming ?? cited[0] ?? null;
}

function card(result: SearchResult, terms: readonly string[]): ReportCard {
  const { profile, metrics } = result;
  const proof = proofClaim(result, terms);
  return {
    rank: result.rank,
    kind: profile.kind,
    name: profile.name.value,
    role: firstValue(profile, "role"),
    unit: firstValue(profile, "unit"),
    novelty: novelty(result),
    covers: metrics?.covers ?? [],
    missing: metrics?.missing ?? [],
    proof: proof && {
      span: proof.claim.evidence.span,
      pageUrl: proof.claim.evidence.page_url,
      fetchedAt: proof.claim.evidence.fetched_at ?? null,
    },
    relevance: percent(metrics?.relevance ?? null),
    evidence: percent(metrics?.evidence ?? null),
    completeness: metrics
      ? `${metrics.completeness.filled} of ${metrics.completeness.of}`
      : notComputed,
    confidence: !metrics
      ? notComputed
      : metrics.confidence === null
        ? "not yet calibrated"
        : percent(metrics.confidence),
    details: [
      { label: "Projects", value: joined(profile, "projects") },
      { label: "Infrastructure", value: joined(profile, "infrastructure") },
      { label: "Services", value: joined(profile, "services") },
    ],
    sourceUrl: profile.source_url,
  };
}

function topicsOf(results: SearchResponse["results"]): string[] {
  const topics = results.flatMap((result) => [
    ...(result.metrics?.covers ?? []),
    ...(result.metrics?.missing ?? []),
  ]);
  return [...new Set(topics)];
}

/** Null when there is nothing to report: an abstained answer or no results. */
export function buildReport(
  response: SearchResponse,
  madeAt: string,
  fixture: boolean,
): MatchReport | null {
  if (response.abstained || response.results.length === 0) return null;
  const topics = topicsOf(response.results);
  const highlightTerms = [...topics, ...response.expanded_terms.map((term) => term.term)];
  return {
    query: response.query,
    needs: response.brief_terms ?? [],
    topics,
    addedWordings: response.expanded_terms,
    highlightTerms,
    cards: response.results.map((result) => card(result, highlightTerms)),
    modeLabels: [modeLabel[response.mode], ...(fixture ? ["FIXTURE"] : [])],
    snapshot: response.versions.snapshot,
    madeAt,
  };
}
