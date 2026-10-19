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
    /**
     * When the result's own claims do not match the question but a related project or unit does: the relation (its verbatim span on its page) and the related profile's matching claims, inline, so both sentences are shown and checked.
     */
    via?: {
      kind: "leads" | "works_on" | "member_of";
      span: string;
      page_url: string;
      page_sha256: string;
      start?: number;
      fetched_at?: string;
      related_profile_id: string;
      related_name: string;
      /**
       * @minItems 1
       */
      related_claims: [Claim, ...Claim[]];
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
 * A person, unit, project or infrastructure built from stored pages. Every value is a claim with a verbatim span from a stored page; a field the pages do not support is an empty list, never a guess. No email or phone is stored: contact goes through the source page link. Calls, services and spaces (opportunities) use the optional fields funder, deadline, amount, eligibility, location and size; dates and amounts are verbatim text from the page, never parsed or computed.
 */
export interface Profile {
  id: string;
  kind: "person" | "unit" | "project" | "infrastructure" | "call" | "service" | "space";
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
    funder?: Claims;
    deadline?: Claims;
    amount?: Claims;
    eligibility?: Claims;
    location?: Claims;
    size?: Claims;
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
  /**
   * degraded when a model call failed in the last hour, or when the mode is live and today's call budget is used up.
   */
  status?: "ok" | "degraded";
  uptime_s?: number;
  /**
   * Failed model calls in the last hour, counted per role and failure marker. Markers only, never error text.
   */
  failures_last_hour?: {
    [k: string]: {
      [k: string]: number;
    };
  };
  /**
   * Live model calls allowed and used today (UTC day). Absent when the mode is not live.
   */
  budget?: {
    limit: number;
    used: number;
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
      /**
       * Not needed to finish the story; its steps may complete in any order.
       */
      optional?: boolean;
      /**
       * One line for the player: why the quest cannot be played yet. Shown while a step's event is not emitted by any feature.
       */
      coming?: string;
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
      /**
       * Not needed to finish the story; its steps may complete in any order.
       */
      optional?: boolean;
      /**
       * One line for the player: why the quest cannot be played yet. Shown while a step's event is not emitted by any feature.
       */
      coming?: string;
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

/**
 * POST /api/agent. The Navigator agent answers only from its tool results: every person it names appears in `mentions`, and every mention is a profile in one of `results`. Actions are things the app does on screen; the agent never contacts anyone.
 */
export interface AgentReply {
  reply: string;
  mode: "live" | "replay" | "mock";
  abstained?: boolean;
  /**
   * @maxItems 6
   */
  actions: (
    | {
        type: "show_on_map";
        result: number;
      }
    | {
        type: "open_profile";
        profile_id: string;
      }
    | {
        type: "start_match_report";
        result: number;
      }
  )[];
  /**
   * @maxItems 4
   */
  results: SearchResponse[];
  mentions: {
    profile_id: string;
    name: string;
  }[];
  tool_calls?: {
    tool: "search" | "brief" | "profile";
    query?: string;
  }[];
  versions: {
    engine: string;
    snapshot: string;
    prompts: string;
    models?: {
      [k: string]: string;
    };
  };
}

/**
 * GET /api/sources. Every institution configured under sources/, with what the loaded snapshot holds from it. Counts are read from the stored pages and profiles, never estimated.
 */
export interface SourcesList {
  snapshot: string;
  sources: {
    id: string;
    name: string;
    hosts: string[];
    /**
     * The profile kinds the snapshot holds for this source.
     */
    kinds: ("person" | "unit" | "project" | "infrastructure" | "call" | "service" | "space")[];
    pages: number;
    profiles: number;
    /**
     * When the most recently fetched page of this source was fetched; null only when it has no pages.
     */
    newest_fetched_at: string | null;
  }[];
}

export type Share = number;

/**
 * GET /api/numbers. The measured numbers for the loaded snapshot: its evaluation as committed in eval/results/<snapshot>/metrics.json, and the model calls recorded in its cache pack.
 */
export interface Numbers {
  snapshot: string;
  /**
   * When the engine answered.
   */
  generated_at: string;
  /**
   * The evaluation of this snapshot; null when none is committed.
   */
  eval: EvalNumbers | null;
  /**
   * One entry per role and model, computed from the cache pack entries (role, model, latency_ms); a role with no entries is not listed. The pack holds no failure records, so ok equals calls; failures show only in the health response's failures_last_hour.
   */
  models: {
    role: string;
    model: string;
    calls: number;
    ok: number;
    median_ms: number;
    p95_ms: number;
  }[];
}
/**
 * The evaluator's measurements on the gold set (eval/gold.jsonl): invented_abstained counts the questions about invented entities the search abstained on, false_abstention the answerable questions it abstained on, traceable the shown claims whose span is in their stored page's text.
 */
export interface EvalNumbers {
  queries: number;
  /**
   * The share with its confidence interval.
   */
  recall_at_10: {
    value: Share;
    low: Share;
    high: Share;
  };
  mrr: Share;
  invented_abstained: Tally;
  false_abstention: Tally;
  traceable: Tally;
  /**
   * Profiles shown, directly or through a related profile, that the snapshot does not hold.
   */
  invented_entities: number;
  slices: {
    name: string;
    recall_at_10: Share;
  }[];
}
export interface Tally {
  n: number;
  of: number;
}
