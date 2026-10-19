"use client";

import { useRef, useState } from "react";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { OpportunitiesApi, OpportunitiesFailure } from "./opportunities-api";
import { type OpportunityRequest, opportunityRequest } from "./opportunity-request";

export type OpportunitiesState =
  | { status: "idle" }
  | { status: "loading"; request: OpportunityRequest }
  | { status: "done"; request: OpportunityRequest; response: SearchResponse }
  | { status: "failed"; request: OpportunityRequest; failure: OpportunitiesFailure };

export type OpportunitiesController = {
  readonly state: OpportunitiesState;
  /** False when the query is empty or too long, so nothing was sent. */
  search(query: string): boolean;
  retry(): void;
};

/** A newer search wins: an answer to an older one that arrives late is dropped. */
export function useOpportunities(api: OpportunitiesApi): OpportunitiesController {
  const [state, setState] = useState<OpportunitiesState>({ status: "idle" });
  const latest = useRef(0);

  function run(request: OpportunityRequest) {
    const ticket = ++latest.current;
    setState({ status: "loading", request });
    void api.search(request).then((outcome) => {
      if (ticket !== latest.current) return;
      setState(
        outcome.ok
          ? { status: "done", request, response: outcome.response }
          : { status: "failed", request, failure: outcome.failure },
      );
    });
  }

  return {
    state,
    search: (query) => {
      const request = opportunityRequest(query);
      if (request === null) return false;
      run(request);
      return true;
    },
    retry: () => {
      if (state.status === "failed") run(state.request);
    },
  };
}
