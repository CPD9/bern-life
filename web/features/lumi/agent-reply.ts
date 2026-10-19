// Bärnli's answer from POST /api/agent, checked against contracts/agent.schema.json with the
// precompiled validator infrastructure/contract.ts uses, then narrowed to what the panel renders.
// The panel's own shape is written out here. A body that fails the check is no answer at all,
// never a partial render.
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { isAgentReply } from "@/infrastructure/contract-validators.generated";

export type AnswerMode = SearchResponse["mode"];

export type AgentAction =
  | { readonly type: "show_on_map"; readonly result: number }
  | { readonly type: "open_profile"; readonly profile_id: string }
  | { readonly type: "start_match_report"; readonly result: number };

export type AgentMention = { readonly profile_id: string; readonly name: string };

export type AgentReply = {
  readonly reply: string;
  readonly mode: AnswerMode;
  readonly abstained: boolean;
  readonly actions: readonly AgentAction[];
  readonly results: readonly SearchResponse[];
  readonly mentions: readonly AgentMention[];
};

/**
 * The reply, or null when it breaks the contract or names someone without a card: the panel
 * promises that every person Bärnli names comes with one.
 */
export function parseAgentReply(body: unknown): AgentReply | null {
  if (!isAgentReply(body)) return null;
  const { reply, mode, abstained = false, actions, results, mentions } = body;
  const profiles = new Set(
    results.flatMap((response) => response.results.map((r) => r.profile.id)),
  );
  if (!mentions.every((mention) => profiles.has(mention.profile_id))) return null;
  return { reply, mode, abstained, actions, results, mentions };
}
