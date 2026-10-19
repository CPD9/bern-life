// Lumi's "open profile" shows the answer that names the profile in Ask, without asking the engine
// a second time: the chat's api remembers the answers of Lumi's latest reply, and the Navigator's
// api serves a handed-over answer once, to the search for that answer's own query.
import type { LumiApi } from "@/features/lumi/lumi-api";
import type { NavigatorApi } from "@/features/navigator/navigator-api";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

export type RememberingLumiApi = LumiApi & {
  /** The answer in Lumi's latest reply that lists this profile, if any. */
  answerListing(profileId: string): SearchResponse | null;
};

export function rememberingLumiApi(api: LumiApi): RememberingLumiApi {
  let latest: readonly SearchResponse[] = [];
  return {
    ask: async (messages) => {
      const outcome = await api.ask(messages);
      latest = outcome.ok ? outcome.value.results : [];
      return outcome;
    },
    search: (query) => api.search(query),
    answerListing: (profileId) =>
      latest.find((answer) => answer.results.some((result) => result.profile.id === profileId)) ??
      null,
  };
}

export type HandOverNavigatorApi = NavigatorApi & {
  /** The next search for `response.query` resolves to `response` instead of asking the engine. */
  handOver(response: SearchResponse): void;
};

export function handOverNavigatorApi(api: NavigatorApi): HandOverNavigatorApi {
  let waiting: SearchResponse | null = null;
  return {
    search: async (request) => {
      const answer = waiting;
      waiting = null;
      if (answer !== null && answer.query === request.query) return { ok: true, response: answer };
      return api.search(request);
    },
    brief: (input) => {
      waiting = null;
      return api.brief(input);
    },
    handOver: (response) => {
      waiting = response;
    },
  };
}
