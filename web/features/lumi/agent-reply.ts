// Lumi's answer from POST /api/agent (contracts/agent.schema.json), narrowed to what the panel
// renders. Until the generated AgentReply type lands, the parts the panel reads are checked here;
// each embedded search answer goes through the result schema, because the cards read it deeply.
// A body that fails any check is no answer at all, never a partial render.
import { parseSearchResponse } from "@/infrastructure/contract";
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

const modes: readonly AnswerMode[] = ["live", "replay", "mock"];

type Fields = Record<string, unknown>;

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function parseAction(value: unknown): AgentAction | null {
  if (!isFields(value)) return null;
  const { type, result, profile_id } = value;
  if ((type === "show_on_map" || type === "start_match_report") && isIndex(result)) {
    return { type, result };
  }
  if (type === "open_profile" && typeof profile_id === "string") return { type, profile_id };
  return null;
}

function parseMention(value: unknown): AgentMention | null {
  if (!isFields(value)) return null;
  const { profile_id, name } = value;
  return typeof profile_id === "string" && typeof name === "string" ? { profile_id, name } : null;
}

/** Every item parsed, or null when any one of them does not. */
function parseAll<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: T[] = [];
  for (const item of value) {
    const one = parse(item);
    if (one === null) return null;
    parsed.push(one);
  }
  return parsed;
}

export function parseAgentReply(body: unknown): AgentReply | null {
  if (!isFields(body)) return null;
  const { reply, mode, abstained = false } = body;
  const knownMode = modes.find((known) => known === mode);
  if (typeof reply !== "string" || !knownMode || typeof abstained !== "boolean") return null;
  const actions = parseAll(body.actions, parseAction);
  const results = parseAll(body.results, parseSearchResponse);
  const mentions = parseAll(body.mentions, parseMention);
  if (!actions || !results || !mentions) return null;
  return { reply, mode: knownMode, abstained, actions, results, mentions };
}
