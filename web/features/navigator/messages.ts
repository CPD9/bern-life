// Every sentence here is read in two seconds: what happened, then what to do next.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { BriefUnread, NavigatorFailure } from "./navigator-api";

const unreadMessages: Record<BriefUnread, string> = {
  no_model:
    "No model is connected, so a new brief cannot be read. Ask a question instead; the search itself needs no model.",
  not_recorded:
    "This brief has not been read before. A new brief is read only on a live run by a signed-in account; ask a question instead.",
  budget_used:
    "Today's Apertus calls are used up, so this brief could not be read. Try again tomorrow, or ask a question instead.",
  model_failed: "Apertus did not answer while reading your brief. Try again in a moment.",
  no_need_found:
    "Apertus found no need in this brief that it could quote word for word. Paste the sentences that say what your project needs.",
};

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
        case "too_long":
          return "This brief is longer than 20,000 characters. Paste the key paragraphs instead.";
      }
    case "unread":
      return unreadMessages[failure.reason];
  }
}

/**
 * Trying again helps when the server or the model did not answer. A brief the app refused needs a
 * new file, a request over the limit would be refused again, and a brief nobody recorded, a spent
 * budget or a reply with no quotable need would come back the same.
 */
export function canRetry(failure: NavigatorFailure): boolean {
  switch (failure.kind) {
    case "network":
      return true;
    case "engine":
      return failure.error !== "rate_limited";
    case "unread":
      return failure.reason === "model_failed";
    case "brief":
      return false;
  }
}

export function abstainMessage(response: SearchResponse): string {
  switch (response.abstain_reason) {
    case "no_verifiable_source":
      return "No public page we hold supports an answer to this. We would rather say so than guess.";
    case "query_out_of_scope":
      return "This is outside what the Navigator covers: research and expertise at the University of Bern, ARTORG and Diabetes Center Berne.";
    default:
      return "The search could not finish, so there is nothing we can show.";
  }
}
