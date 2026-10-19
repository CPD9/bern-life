"use client";

// One conversation with Lumi. Actions in a reply are dispatched from the request that received it,
// not from rendering, so a re-render can never repeat them. One message is in flight at a time.
import { useRef, useState } from "react";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { AgentReply } from "./agent-reply";
import { type SearchState, type Turn, isBusy, messagesFor } from "./conversation";
import type { ChatMessage, LumiApi } from "./lumi-api";

export type LumiActions = {
  onShowOnMap?: ((response: SearchResponse) => void) | undefined;
  onOpenProfile?: ((profileId: string) => void) | undefined;
  onStartMatchReport?: ((response: SearchResponse) => void) | undefined;
};

export function dispatchActions(reply: AgentReply, actions: LumiActions): void {
  for (const action of reply.actions) {
    if (action.type === "open_profile") {
      actions.onOpenProfile?.(action.profile_id);
      continue;
    }
    const response = reply.results[action.result];
    if (!response) continue;
    if (action.type === "show_on_map") actions.onShowOnMap?.(response);
    else actions.onStartMatchReport?.(response);
  }
}

export type LumiChatController = {
  readonly turns: readonly Turn[];
  readonly busy: boolean;
  send(text: string): void;
  retry(): void;
};

const waiting = { status: "waiting" } as const;

export function useLumiChat(api: LumiApi, actions: LumiActions): LumiChatController {
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const nextId = useRef(0);
  const last = turns.at(-1);

  function update(id: number, change: Partial<Pick<Turn, "lumi" | "search">>) {
    setTurns((current) => current.map((turn) => (turn.id === id ? { ...turn, ...change } : turn)));
  }

  async function answer(id: number, text: string, messages: ChatMessage[]) {
    const asked = await api.ask(messages);
    if (asked.ok) {
      const { abstained } = asked.value;
      update(id, {
        lumi: { status: "replied", reply: asked.value },
        search: abstained ? waiting : null,
      });
      dispatchActions(asked.value, actions);
      if (!abstained) return;
    } else {
      // Without the server a plain search cannot answer either, so there is nothing to fall back to.
      const fallback = asked.failure !== "network";
      update(id, {
        lumi: { status: "failed", failure: asked.failure },
        search: fallback ? waiting : null,
      });
      if (!fallback) return;
    }
    const searched = await api.search(text);
    const search: SearchState = searched.ok
      ? { status: "done", response: searched.value }
      : { status: "failed", failure: searched.failure };
    update(id, { search });
  }

  return {
    turns,
    busy: isBusy(last),
    send: (message) => {
      const text = message.trim();
      if (text === "" || isBusy(last)) return;
      const id = nextId.current++;
      setTurns([...turns, { id, text, lumi: waiting, search: null }]);
      void answer(id, text, messagesFor(turns, text));
    },
    retry: () => {
      if (!last || isBusy(last)) return;
      update(last.id, { lumi: waiting, search: null });
      void answer(last.id, last.text, messagesFor(turns.slice(0, -1), last.text));
    },
  };
}
