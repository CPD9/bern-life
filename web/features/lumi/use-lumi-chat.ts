"use client";

// One conversation with Lumi. Actions in a reply are dispatched from the request that received it,
// not from rendering, so a re-render can never repeat them; a reply that lands while the panel is
// closed keeps its actions on its turn until the player runs them. One message is in flight.
import { useEffect, useRef, useState } from "react";
import type { AgentAction } from "./agent-reply";
import { type SearchState, type Turn, canRetry, isBusy, messagesFor } from "./conversation";
import type { ChatMessage, LumiApi } from "./lumi-api";
import { type LumiActions, canRun, runAction } from "./reply-actions";

export type { LumiActions } from "./reply-actions";

export type LumiChatController = {
  readonly turns: readonly Turn[];
  readonly busy: boolean;
  /** False when nothing was sent: an empty message, or one still in flight. */
  send(text: string): boolean;
  retry(): boolean;
  /** Runs an action that waited while the panel was closed; false if it already ran. */
  runHeld(turnId: number, action: AgentAction): boolean;
};

const waiting = { status: "waiting" } as const;

export function useLumiChat(api: LumiApi, actions: LumiActions, open: boolean): LumiChatController {
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  const nextId = useRef(0);
  // State lags a render behind, so a quick second tap is stopped by this as well.
  const inFlight = useRef(false);
  const ran = useRef(new Set<AgentAction>());
  // A reply acts through the callbacks of the moment it lands, and never on its own once the panel
  // is closed: a late answer must not move the map or open anything behind the player's back.
  const current = useRef({ actions, open });
  useEffect(() => {
    current.current = { actions, open };
  });
  const last = turns.at(-1);

  function update(id: number, change: Partial<Pick<Turn, "lumi" | "search">>) {
    setTurns((shown) => shown.map((turn) => (turn.id === id ? { ...turn, ...change } : turn)));
  }

  async function answer(id: number, text: string, messages: ChatMessage[]) {
    inFlight.current = true;
    try {
      await exchange(id, text, messages);
    } finally {
      inFlight.current = false;
    }
  }

  async function exchange(id: number, text: string, messages: ChatMessage[]) {
    const asked = await api.ask(messages);
    if (asked.ok) {
      const reply = asked.value;
      const { open: shown, actions: now } = current.current;
      const held = shown ? [] : reply.actions.filter((action) => canRun(action, reply, now));
      update(id, {
        lumi: { status: "replied", reply, held },
        search: reply.abstained ? waiting : null,
      });
      if (shown) for (const action of reply.actions) runAction(action, reply, now);
      if (!reply.abstained) return;
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
      if (text === "" || inFlight.current || isBusy(last)) return false;
      const id = nextId.current++;
      setTurns((shown) => [...shown, { id, text, lumi: waiting, search: null }]);
      void answer(id, text, messagesFor(turns, text));
      return true;
    },
    retry: () => {
      if (!last || inFlight.current || !canRetry(last)) return false;
      update(last.id, { lumi: waiting, search: null });
      void answer(last.id, last.text, messagesFor(turns.slice(0, -1), last.text));
      return true;
    },
    runHeld: (turnId, action) => {
      const turn = turns.find((candidate) => candidate.id === turnId);
      if (turn?.lumi.status !== "replied" || ran.current.has(action)) return false;
      ran.current.add(action);
      setTurns((shown) => shown.map((t) => (t.id === turnId ? withoutHeld(t, action) : t)));
      runAction(action, turn.lumi.reply, current.current.actions);
      return true;
    },
  };
}

function withoutHeld(turn: Turn, action: AgentAction): Turn {
  if (turn.lumi.status !== "replied") return turn;
  return { ...turn, lumi: { ...turn.lumi, held: turn.lumi.held.filter((a) => a !== action) } };
}
