// Lumi's answer from POST /api/agent, checked against contracts/agent.schema.json the way
// infrastructure/contract.ts checks the other responses, then narrowed to what the panel renders.
// Until the generated AgentReply type lands, the shape is written out here. A body that fails the
// check is no answer at all, never a partial render.
import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import agentSchema from "../../../contracts/agent.schema.json";
import profileSchema from "../../../contracts/profile.schema.json";
import resultSchema from "../../../contracts/result.schema.json";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

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

type AgentReplyBody = Omit<AgentReply, "abstained"> & { readonly abstained?: boolean };

const ajv = new Ajv2020({ strict: true });
addFormats(ajv);
ajv.addSchema(profileSchema);
ajv.addSchema(resultSchema);
const isAgentReply = ajv.compile<AgentReplyBody>(agentSchema);

/**
 * The reply, or null when it breaks the contract or names someone without a card: the panel
 * promises that every person Lumi names comes with one.
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
