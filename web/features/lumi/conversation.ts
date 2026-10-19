// The conversation as plain data, kept in the panel's state only: nothing of it is stored on the
// server or in the browser. These are the pure parts: what is sent, and how a reply links its
// mentions to its cards.
import type { SearchResult } from "@/infrastructure/claims";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { AgentAction, AgentMention, AgentReply } from "./agent-reply";
import type { ChatMessage, LumiFailure } from "./lumi-api";

/** The agent route takes at most this many messages, newest last. */
export const maxMessages = 12;

export type LumiState =
  | { readonly status: "waiting" }
  | {
      readonly status: "replied";
      readonly reply: AgentReply;
      /** Actions that arrived while the panel was closed, left for the player to run. */
      readonly held: readonly AgentAction[];
      /** Actions that never run on their own (a match report keeps a record): one click each. */
      readonly offered: readonly AgentAction[];
      /** Actions clicked but not done, such as a report the browser would not keep; still offered. */
      readonly notDone: readonly AgentAction[];
    }
  | { readonly status: "failed"; readonly failure: LumiFailure };

/** The plain search, asked only when Lumi could not answer. */
export type SearchState =
  | { readonly status: "waiting" }
  | { readonly status: "done"; readonly response: SearchResponse }
  | { readonly status: "failed"; readonly failure: LumiFailure };

export type Turn = {
  readonly id: number;
  readonly text: string;
  readonly lumi: LumiState;
  readonly search: SearchState | null;
};

/**
 * What was said so far plus the new message, trimmed to the newest `maxMessages`. A conversation
 * sent never opens with a reply whose question was trimmed away.
 */
export function messagesFor(turns: readonly Turn[], text: string): ChatMessage[] {
  const said = turns.flatMap((turn): ChatMessage[] => {
    const asked: ChatMessage = { role: "user", content: turn.text };
    return turn.lumi.status === "replied"
      ? [asked, { role: "assistant", content: turn.lumi.reply.reply }]
      : [asked];
  });
  const kept = [...said, { role: "user" as const, content: text }].slice(-maxMessages);
  return kept[0]?.role === "assistant" ? kept.slice(1) : kept;
}

export function isAnswered(turn: Turn): boolean {
  return turn.lumi.status === "replied" || turn.search?.status === "done";
}

export function isBusy(turn: Turn | undefined): boolean {
  return turn?.lumi.status === "waiting" || turn?.search?.status === "waiting";
}

/** The cards of every search behind a reply, each profile once, in the order they came. */
export function answerCards(results: readonly SearchResponse[]): SearchResult[] {
  const seen = new Set<string>();
  return results
    .flatMap((response) => response.results)
    .filter((result) => {
      if (seen.has(result.profile.id)) return false;
      seen.add(result.profile.id);
      return true;
    });
}

export type Segment =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "mention"; readonly text: string; readonly profileId: string };

/**
 * The reply cut into plain text and the names it mentions; every mention has a card (the parser
 * rejects a reply where one does not). Where two names start at the same place, the longer wins.
 */
export function splitMentions(text: string, mentions: readonly AgentMention[]): Segment[] {
  const linked = mentions
    .filter((mention) => mention.name !== "")
    .sort((a, b) => b.name.length - a.name.length);
  const segments: Segment[] = [];
  let from = 0;
  for (;;) {
    let next: { at: number; mention: AgentMention } | null = null;
    for (const mention of linked) {
      const at = text.indexOf(mention.name, from);
      if (at !== -1 && (next === null || at < next.at)) next = { at, mention };
    }
    if (next === null) break;
    if (next.at > from) segments.push({ kind: "text", text: text.slice(from, next.at) });
    segments.push({ kind: "mention", text: next.mention.name, profileId: next.mention.profile_id });
    from = next.at + next.mention.name.length;
  }
  if (from < text.length) segments.push({ kind: "text", text: text.slice(from) });
  return segments;
}
