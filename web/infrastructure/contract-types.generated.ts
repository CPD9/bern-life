// Generated from contracts/*.schema.json by `bun run contract:types`. Do not edit.

/**
 * What the engine returns for a query or a project brief (POST /api/search, POST /api/brief). The UI renders only this.
 */
export interface SearchResponse {
  query: string;
  /**
   * For a brief: the needs Apertus read from it, each with the brief sentence it came from. Absent for a plain query.
   */
  brief_terms?: {
    term: string;
    span: string;
  }[];
  /**
   * live: a model answered now; replay: from the cache; mock: no model, canned text, the UI shows a MOCK banner.
   */
  mode: "live" | "replay" | "mock";
  abstained: boolean;
  abstain_reason?: "no_verifiable_source" | "query_out_of_scope" | "engine_error" | null;
  /**
   * Retrieval terms added by enrichment and query expansion. Used for search only, never shown as a fact about a person.
   */
  expanded_terms: {
    term: string;
    kind: "synonym" | "lay" | "translation" | "acronym";
    lang?: "de" | "en" | "fr" | "it";
  }[];
  /**
   * @maxItems 50
   */
  results: {
    rank: number;
    profile: Profile;
    /**
     * Why it matches, written only from the cited claims. `cites` are JSON pointers into `profile`, e.g. /fields/expertise/0.
     */
    reason: {
      text: string;
      /**
       * @minItems 1
       */
      cites: [string, ...string[]];
    };
    score: {
      fused: number;
      lexical_rank?: number | null;
      vector_rank?: number | null;
    };
    /**
     * Display only: describes a result, never reorders it. null means it could not be computed (shown as a dash, never 0). Computed from verified claims and pages, never from a model's opinion.
     */
    metrics?: {
      relevance: number | null;
      evidence: number | null;
      confidence: number | null;
      covers: string[];
      missing: string[];
      completeness: {
        filled: number;
        of: 5;
      };
      novelty: {
        new_unit: boolean;
        adds: string[];
      };
    };
  }[];
  timings_ms?: {
    [k: string]: number;
  };
  versions: {
    engine: string;
    snapshot: string;
    prompts: string;
    models?: {
      [k: string]: string;
    };
  };
}

export type Claims = Claim[];

/**
 * A person, unit, project or infrastructure built from stored pages. Every value is a claim with a verbatim span from a stored page; a field the pages do not support is an empty list, never a guess. No email or phone is stored: contact goes through the source page link.
 */
export interface Profile {
  id: string;
  kind: "person" | "unit" | "project" | "infrastructure";
  source_id: string;
  name: Claim;
  /**
   * The main page for this profile, shown as the result link.
   */
  source_url: string;
  fields: {
    role: Claims;
    unit: Claims;
    expertise: Claims;
    projects: Claims;
    infrastructure: Claims;
    services: Claims;
  };
}
export interface Claim {
  value: string;
  /**
   * selector: read by a per-source rule; model: proposed by Apertus and kept only because the verifier found the span.
   */
  method: "selector" | "model";
  evidence: Evidence;
}
export interface Evidence {
  page_url: string;
  page_sha256: string;
  /**
   * Verbatim substring of the page's stored text.
   */
  span: string;
  /**
   * Character offset of span in the page text.
   */
  start?: number;
  /**
   * When the page holding the span was fetched (copied from the page record).
   */
  fetched_at?: string;
}

/**
 * GET /api/health. The HUD shows only counts present here; a missing count is not shown, never guessed.
 */
export interface Health {
  mode: "live" | "replay" | "mock";
  models?: {
    [k: string]: string;
  };
  snapshot: string;
  counts: {
    pages?: number;
    profiles?: number;
    sources?: number;
  };
}

/**
 * Story mode: a guided journey whose quests complete only on app events, never by self-report. Each quest names the case criterion it demonstrates.
 */
export interface Story {
  id: string;
  title: string;
  /**
   * @minItems 1
   */
  quests: [
    {
      id: string;
      title: string;
      goal: string;
      criterion:
        | "c1-right-people"
        | "c2-wording"
        | "c3-traceable"
        | "c4-structured"
        | "c5-sources"
        | "c6-extend"
        | "ethics-abstain"
        | "stretch";
      optional?: boolean;
      /**
       * @minItems 1
       */
      steps: [
        {
          id: string;
          text: string;
          /**
           * What the floatie says if the player asks.
           */
          hint?: string;
          done_when:
            | "settled"
            | "office_ready"
            | "search_answered"
            | "search_answered_other_language"
            | "brief_answered"
            | "evidence_opened"
            | "report_made"
            | "lobby_entered"
            | "abstained_seen"
            | "source_added"
            | "numbers_seen"
            | "opportunity_saved"
            | "connection_saved"
            | "library_item_saved"
            | "message_sent"
            | "garage_visited";
        },
        ...{
          id: string;
          text: string;
          /**
           * What the floatie says if the player asks.
           */
          hint?: string;
          done_when:
            | "settled"
            | "office_ready"
            | "search_answered"
            | "search_answered_other_language"
            | "brief_answered"
            | "evidence_opened"
            | "report_made"
            | "lobby_entered"
            | "abstained_seen"
            | "source_added"
            | "numbers_seen"
            | "opportunity_saved"
            | "connection_saved"
            | "library_item_saved"
            | "message_sent"
            | "garage_visited";
        }[]
      ];
    },
    ...{
      id: string;
      title: string;
      goal: string;
      criterion:
        | "c1-right-people"
        | "c2-wording"
        | "c3-traceable"
        | "c4-structured"
        | "c5-sources"
        | "c6-extend"
        | "ethics-abstain"
        | "stretch";
      optional?: boolean;
      /**
       * @minItems 1
       */
      steps: [
        {
          id: string;
          text: string;
          /**
           * What the floatie says if the player asks.
           */
          hint?: string;
          done_when:
            | "settled"
            | "office_ready"
            | "search_answered"
            | "search_answered_other_language"
            | "brief_answered"
            | "evidence_opened"
            | "report_made"
            | "lobby_entered"
            | "abstained_seen"
            | "source_added"
            | "numbers_seen"
            | "opportunity_saved"
            | "connection_saved"
            | "library_item_saved"
            | "message_sent"
            | "garage_visited";
        },
        ...{
          id: string;
          text: string;
          /**
           * What the floatie says if the player asks.
           */
          hint?: string;
          done_when:
            | "settled"
            | "office_ready"
            | "search_answered"
            | "search_answered_other_language"
            | "brief_answered"
            | "evidence_opened"
            | "report_made"
            | "lobby_entered"
            | "abstained_seen"
            | "source_added"
            | "numbers_seen"
            | "opportunity_saved"
            | "connection_saved"
            | "library_item_saved"
            | "message_sent"
            | "garage_visited";
        }[]
      ];
    }[]
  ];
}
