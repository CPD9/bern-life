// Every sentence the panel says about a state, in one place. No raw error ever reaches the screen.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { type LumiState, type SearchState, type Turn, answerCards } from "./conversation";
import type { LumiFailure } from "./lumi-api";

export function lumiFailureMessage(failure: LumiFailure, name: string): string {
  switch (failure) {
    case "not_connected":
      return `${name} is not connected yet.`;
    case "network":
      return "We could not reach the Bern Life server. Check your connection and try again.";
    case "bad_request":
      return `${name} could not read this message. Try rephrasing it.`;
    case "rate_limited":
      return "Too many requests from here right now; try again in a few minutes.";
    case "malformed":
      return `${name}'s answer could not be read, so nothing of it is shown.`;
    case "engine_error":
      return `${name} is not answering right now.`;
  }
}

export function searchFailureMessage(failure: LumiFailure): string {
  switch (failure) {
    case "network":
      return "We could not reach the Bern Life server. Check your connection and try again.";
    case "bad_request":
      return "The search could not read this message. Try rephrasing it.";
    case "rate_limited":
      return "Too many requests from here right now; try again in a few minutes.";
    case "not_connected":
      return "The search is not connected yet.";
    case "malformed":
    case "engine_error":
      return "The search is not answering right now. Try again in a moment.";
  }
}

export function searchSummary(response: SearchResponse): string {
  if (response.abstained) {
    switch (response.abstain_reason) {
      case "no_verifiable_source":
        return "No public page we hold supports an answer to this. We would rather say so than guess.";
      case "query_out_of_scope":
        return "This is outside what the search covers: research and expertise at the University of Bern, ARTORG and Diabetes Center Berne.";
      default:
        return "The search could not finish, so there is nothing we can show.";
    }
  }
  const count = response.results.length;
  return count === 0 ? "Nothing matched." : `${count} ${count === 1 ? "result" : "results"}`;
}

function searchStatus(search: SearchState): string {
  switch (search.status) {
    case "waiting":
      return "Searching public pages…";
    case "failed":
      return searchFailureMessage(search.failure);
    case "done":
      return `Plain search answer: ${searchSummary(search.response)}.`;
  }
}

function lumiSaid(lumi: Exclude<LumiState, { status: "waiting" }>, name: string): string {
  if (lumi.status === "failed") return lumiFailureMessage(lumi.failure, name);
  const cards = answerCards(lumi.reply.results).length;
  if (cards === 0) return lumi.reply.reply;
  return `${lumi.reply.reply} ${cards} ${cards === 1 ? "card" : "cards"}.`;
}

/**
 * The one line a screen reader hears about the latest exchange, so it is told what changed
 * without every card being read aloud.
 */
export function statusSentence(turn: Turn | undefined, name: string): string {
  if (!turn) return "";
  if (turn.lumi.status === "waiting") return `${name} is answering…`;
  const said = lumiSaid(turn.lumi, name);
  return turn.search ? `${said} ${searchStatus(turn.search)}` : said;
}
