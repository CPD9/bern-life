"use client";

// One conversation with Bärnli. No action in a reply runs by itself: with the panel open each one is
// a button under the reply, so the answer stays on screen; a reply that lands while the panel is
// closed keeps its actions on its turn until the player runs them. An action runs only from its
// click, never from rendering, so a re-render cannot repeat it. One message is in flight.
import { useEffect, useRef, useState } from "react";
import type { AgentAction } from "./agent-reply";
import { type SearchState, type Turn, canRetry, isBusy, messagesFor } from "./conversation";
import type { ChatMessage, LumiApi } from "./lumi-api";
import { type LumiActions, canRun, runAction, waitsForClick } from "./reply-actions";

export type { LumiActions } from "./reply-actions";

export type LumiChatController = {
  readonly turns: readonly Turn[];
  readonly busy: boolean;
  /** False when nothing was sent: an empty message, or one still in flight. */
  send(text: string): boolean;
  retry(): boolean;
  /** Runs an action that waited for the player (held or offered); false if it already ran. */
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
      const runnable = reply.actions.filter((action) => canRun(action, reply, now));
      // With the panel open every action is a button under the reply: the answer stays readable
      // and the player chooses when to leave the chat for the map or Ask.
      const held = shown ? [] : runnable.filter((action) => !waitsForClick(action));
      const offered = shown ? runnable : runnable.filter(waitsForClick);
      update(id, {
        lumi: { status: "replied", reply, held, offered, notDone: [] },
        search: reply.abstained ? waiting : null,
      });
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
      const done = runAction(action, turn.lumi.reply, current.current.actions);
      // Not done (a report the browser would not keep): its button stays, with the reason, to retry.
      if (!done) ran.current.delete(action);
      setTurns((shown) => shown.map((t) => (t.id === turnId ? afterRun(t, action, done) : t)));
      return done;
    },
  };
}

function afterRun(turn: Turn, action: AgentAction, done: boolean): Turn {
  if (turn.lumi.status !== "replied") return turn;
  const { held, offered, notDone } = turn.lumi;
  const without = (actions: readonly AgentAction[]) => actions.filter((a) => a !== action);
  const lumi = done
    ? { ...turn.lumi, held: without(held), offered: without(offered), notDone: without(notDone) }
    : { ...turn.lumi, notDone: [...without(notDone), action] };
  return { ...turn, lumi };
}
