import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { NavigatorFailure } from "./navigator-api";

export function failureMessage(failure: NavigatorFailure): string {
  switch (failure.kind) {
    case "network":
      return "We could not reach the Bern Life server. Check your connection and try again.";
    case "engine":
      switch (failure.error) {
        case "bad_request":
          return "The search could not read this request. Try rephrasing it.";
        case "rate_limited":
          return "Too many requests from here right now; try again in a few minutes.";
        default:
          return "The search is not answering right now. Try again in a moment.";
      }
    case "brief":
      switch (failure.reason) {
        case "empty":
          return "Add a PDF or paste the text of your brief first.";
        case "too_large":
          return "The PDF is larger than 5 MB. Upload a smaller file or paste the text.";
        case "not_pdf":
          return "That file is not a PDF. Upload a PDF or paste the text.";
        case "too_many_pages":
          return "The PDF has more than 20 pages. Upload a shorter brief or paste the key part.";
        case "unreadable":
          return "We could not read that PDF. Try another file or paste the text.";
        case "no_text":
          return "We found no text in that PDF; it may be a scan. Paste the text instead.";
      }
  }
}

/** A brief the app refused needs a new file, and a request over the limit would be refused again. */
export function canRetry(failure: NavigatorFailure): boolean {
  return (
    failure.kind === "network" || (failure.kind === "engine" && failure.error !== "rate_limited")
  );
}

/**
 * A brief the engine returned without reading it: no model answered and the replay holds no call
 * for this text, so there were no needs to search for. That says nothing about the pages we hold.
 */
export function briefUnread(response: SearchResponse): boolean {
  return (
    response.abstain_reason === "no_verifiable_source" &&
    response.mode === "mock" &&
    (response.brief_terms ?? []).length === 0
  );
}

export function abstainMessage(response: SearchResponse, asked: "search" | "brief"): string {
  if (asked === "brief" && briefUnread(response)) {
    return "Reading a new brief needs Apertus connected live; only briefs recorded earlier can be read here.";
  }
  switch (response.abstain_reason) {
    case "no_verifiable_source":
      return "No public page we hold supports an answer to this. We would rather say so than guess.";
    case "query_out_of_scope":
      return "This is outside what the Navigator covers: research and expertise at the University of Bern, ARTORG and Diabetes Center Berne.";
    default:
      return "The search could not finish, so there is nothing we can show.";
  }
}
