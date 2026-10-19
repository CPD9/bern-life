// The agent's loops search through the Navigator's engine call. A refusal over the limit stays
// apart from other failures, so a loop asks the player to wait instead of running again at once:
// that run would be refused too, and would count.
import type { LoopSearch } from "@/features/agents/use-loops";
import type { NavigatorApi } from "@/features/navigator/navigator-api";

export function loopSearch(api: NavigatorApi): LoopSearch {
  return async (query) => {
    const outcome = await api.search({ query });
    if (outcome.ok) return outcome.response;
    const { failure } = outcome;
    return failure.kind === "engine" && failure.error === "rate_limited" ? "rate_limited" : null;
  };
}
