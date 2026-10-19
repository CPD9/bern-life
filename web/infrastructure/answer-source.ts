// The engine reports a mode ("live", "replay", "mock"), a snapshot and whether it is reachable. A
// visitor should read one calm status in plain words, the same everywhere, with the explanation
// one tap away; the engine's own words never reach the screen. Nothing here claims more than the
// engine reports: "mock" from a real engine is the stored pages searched with the visitor's words,
// and only the fixture snapshot is invented data.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

export type EngineMode = SearchResponse["mode"];

export type AnswerSourceKind = "live" | "recorded" | "own_words" | "sample" | "offline";

export type AnswerSource = {
  readonly kind: AnswerSourceKind;
  readonly label: string;
  readonly sentence: string;
  readonly explanation: string;
  /** Only Offline and Sample data warn; everything else is quiet secondary text. */
  readonly tone: "quiet" | "warn";
};

const facts =
  "Every fact shown is a quoted span on a stored public page, with a link to the page it came from.";

const sources: Record<AnswerSourceKind, AnswerSource> = {
  live: {
    kind: "live",
    label: "Live",
    sentence: "Apertus added search terms and explanations just now.",
    explanation: `Apertus, the model behind Bern Life, is connected. It widened your question with related search terms and wrote each explanation from the claims that result cites. ${facts}`,
    tone: "quiet",
  },
  recorded: {
    kind: "recorded",
    label: "Recorded",
    sentence:
      "Apertus's search terms for this question were recorded earlier; the search itself ran just now over the stored pages.",
    explanation: `This question is one of a set whose Apertus calls were recorded in advance, so no model ran today. The search used those recorded terms over the stored public pages just now. ${facts}`,
    tone: "quiet",
  },
  own_words: {
    kind: "own_words",
    label: "Your words only",
    sentence:
      "No recorded Apertus terms exist for this wording, so the search used your words alone. Every result still comes from a stored page.",
    explanation: `Apertus adds search terms only for questions recorded in advance, or when it is connected live. For this wording there are none, so the search matched your words as written against the stored public pages; results can be narrower than with added terms. ${facts}`,
    tone: "quiet",
  },
  sample: {
    kind: "sample",
    label: "Sample data",
    sentence: "These results are invented sample data, not pages.",
    explanation:
      "Bern Life is running on sample data for testing. The people, pages and numbers shown are invented and describe no one. Nothing here is a fact about a real person or institution.",
    tone: "warn",
  },
  offline: {
    kind: "offline",
    label: "Offline",
    sentence: "The search service is not reachable.",
    explanation:
      "Bern Life could not reach its search service, so no answer can be made right now. Try again in a moment.",
    tone: "warn",
  },
};

export const sampleDataBanner =
  "Sample data. These results are invented for testing, not from any page.";

/** Three plain sentences for Settings → About, in the same words as every status. */
export const howAnAnswerIsMade: readonly [string, string, string] = [
  "Bern Life reads public pages of the University of Bern, ARTORG and the Diabetes Center Berne and keeps a dated copy of each.",
  "A search matches your question against those stored pages; when Apertus is connected live, or its terms for the question were recorded earlier, it adds related search terms and an explanation.",
  `${facts} Nothing comes from a model's memory.`,
];

/** The status for one answer or one health reading; the fixture snapshot is sample data. */
export function answerSourceFor(mode: EngineMode, fixture: boolean): AnswerSource {
  if (fixture) return sources.sample;
  if (mode === "live") return sources.live;
  if (mode === "replay") return sources.recorded;
  return sources.own_words;
}

export const offlineSource: AnswerSource = sources.offline;

type HealthReading =
  | { readonly status: "waiting" }
  | {
      readonly status: "ok";
      readonly health: { readonly mode: EngineMode; readonly snapshot: string };
    }
  | { readonly status: "offline" };

/** The status chip's source from a health reading; nothing while health is still unknown. */
export function answerSourceForHealth(
  health: HealthReading | undefined,
  fixtureMode: boolean,
): AnswerSource | null {
  if (health === undefined || health.status === "waiting") return null;
  if (health.status === "offline") return sources.offline;
  const { mode, snapshot } = health.health;
  return answerSourceFor(mode, fixtureMode || snapshot === "fixture");
}
