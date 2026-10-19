// Lumi's "open profile" names a profile, not the answer it is in, so the chat's api remembers the
// answers of Lumi's latest reply for the app to find it.
import type { LumiApi } from "@/features/lumi/lumi-api";
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
