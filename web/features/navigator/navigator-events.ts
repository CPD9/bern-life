// Which story events an answer means. Pure, so the rules are tested apart from the hook.
import type { AppEventName } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { SearchRequest } from "@/infrastructure/engine-types";

// Words that only German or French questions use; English filler words are left out on purpose.
const germanOrFrenchWords = new Set([
  "und",
  "der",
  "die",
  "das",
  "des",
  "mit",
  "fur",
  "von",
  "bei",
  "nach",
  "wer",
  "les",
  "pour",
  "avec",
  "une",
  "aux",
  "sur",
  "dans",
  "qui",
]);

export function asksInGermanOrFrench(request: SearchRequest): boolean {
  if (request.lang === "de" || request.lang === "fr") return true;
  if (/[äöüßéèàçâêîôûëï]/i.test(request.query)) return true;
  const words = request.query
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}]+/u);
  return words.some((word) => germanOrFrenchWords.has(word));
}

export type AnsweredRequest = { kind: "search"; search: SearchRequest } | { kind: "brief" };

export function answerEvents(request: AnsweredRequest, response: SearchResponse): AppEventName[] {
  if (response.abstained) {
    return response.abstain_reason === "no_verifiable_source" ? ["abstained_seen"] : [];
  }
  if (response.results.length === 0) return [];
  if (request.kind === "brief") return ["brief_answered"];
  return asksInGermanOrFrench(request.search)
    ? ["search_answered", "search_answered_other_language"]
    : ["search_answered"];
}
