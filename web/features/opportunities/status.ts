import type { OpportunitiesFailure } from "./opportunities-api";
import type { OpportunitiesState } from "./use-opportunities";

const failureText: Record<OpportunitiesFailure, string> = {
  not_connected: "Opportunity search is not connected yet.",
  bad_request: "The search could not read this request. Try rephrasing it.",
  engine_error: "The search is not answering right now. Try again in a moment.",
  network: "We could not reach the Bern Life server. Check your connection and try again.",
};

export function retryable(failure: OpportunitiesFailure): boolean {
  return failure === "engine_error" || failure === "network";
}

/** The one line a screen reader hears after each search; `shown` counts the opportunities listed. */
export function statusLine(state: OpportunitiesState, shown: number): string {
  switch (state.status) {
    case "idle":
      return "";
    case "loading":
      return "Searching public pages…";
    case "failed":
      return failureText[state.failure];
    case "done": {
      const { response } = state;
      if (response.abstained) {
        return response.abstain_reason === "no_verifiable_source"
          ? "No public page we hold supports an answer to this. We would rather say so than guess."
          : response.abstain_reason === "query_out_of_scope"
            ? "This is outside what the search covers."
            : "The search could not finish, so there is nothing we can show.";
      }
      if (shown === 0) return "No funding calls, services or spaces matched.";
      return shown === 1 ? "1 opportunity" : `${shown} opportunities`;
    }
  }
}
