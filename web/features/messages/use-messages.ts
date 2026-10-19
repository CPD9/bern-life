"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { Start } from "./input";
import { type Connect, POLL_MS } from "./live-client";
import type { MessagesApi, MessagesFailure, MessagesOutcome } from "./messages-api";
import type { ConversationSummary, MessageView } from "./types";

export type Every = (run: () => void, ms: number) => () => void;
export const every: Every = (run, ms) => {
  const timer = setInterval(run, ms);
  return () => clearInterval(timer);
};

export type MessagesController = {
  status: "loading" | "signed-out" | "ready";
  conversations: ConversationSummary[];
  openId: string | null;
  /** Oldest first, as a thread reads. */
  thread: MessageView[];
  hasOlder: boolean;
  failure: MessagesFailure | null;
  updates: "live" | "polling";
  open(id: string): Promise<void>;
  send(body: string): Promise<boolean>;
  remove(messageId: string): Promise<void>;
  start(start: Start): Promise<void>;
  loadOlder(): Promise<void>;
};

export function useMessages(
  api: MessagesApi,
  connect: Connect,
  schedule: Every = every,
  events: AppEventSink = appEvents,
): MessagesController {
  const [status, setStatus] = useState<MessagesController["status"]>("loading");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<MessageView[]>([]);
  const [older, setOlder] = useState<string | null>(null);
  const [failure, setFailure] = useState<MessagesFailure | null>(null);
  const [updates, setUpdates] = useState<MessagesController["updates"]>("live");
  const openRef = useRef<string | null>(null);

  const show = useCallback((outcome: MessagesOutcome<ConversationSummary[]>) => {
    if (!outcome.ok) {
      if (outcome.failure === "unauthenticated") setStatus("signed-out");
      else setFailure(outcome.failure);
      return;
    }
    setConversations(outcome.value);
    setStatus("ready");
  }, []);

  const refresh = useCallback(async () => show(await api.conversations()), [api, show]);

  const load = useCallback(
    async (id: string) => {
      const page = await api.page(id, null);
      if (!page.ok) return setFailure(page.failure);
      if (openRef.current !== id) return;
      setThread([...page.value.messages].reverse());
      setOlder(page.value.next);
      await api.markRead(id);
      await refresh();
    },
    [api, refresh],
  );

  useEffect(() => {
    void api.conversations().then(show);
    let stopPolling = () => {};
    const stopLive = connect(
      (notice) => {
        void refresh();
        if (notice.conversationId === openRef.current) void load(notice.conversationId);
      },
      () => {
        setUpdates("polling");
        stopPolling = schedule(() => {
          void refresh();
          if (openRef.current !== null) void load(openRef.current);
        }, POLL_MS);
      },
    );
    return () => {
      stopLive();
      stopPolling();
    };
  }, [api, show, connect, schedule, refresh, load]);

  async function open(id: string) {
    openRef.current = id;
    setOpenId(id);
    setThread([]);
    setFailure(null);
    await load(id);
  }

  return {
    status,
    conversations,
    openId,
    thread,
    hasOlder: older !== null,
    failure,
    updates,
    open,
    async send(body) {
      const id = openRef.current;
      if (id === null || body.trim() === "") return false;
      const posted = await api.post(id, body);
      setFailure(posted.ok ? null : posted.failure);
      if (!posted.ok) return false;
      events.emit("message_sent");
      setThread((current) =>
        current.some((m) => m.id === posted.value.id) ? current : [...current, posted.value],
      );
      await refresh();
      return true;
    },
    async remove(messageId) {
      const id = openRef.current;
      if (id === null) return;
      const removed = await api.remove(id, messageId);
      setFailure(removed.ok ? null : removed.failure);
      if (removed.ok) setThread((current) => current.filter((m) => m.id !== messageId));
    },
    async start(start) {
      const started = await api.start(start);
      setFailure(started.ok ? null : started.failure);
      if (!started.ok) return;
      await refresh();
      await open(started.value);
    },
    async loadOlder() {
      const id = openRef.current;
      if (id === null || older === null) return;
      const page = await api.page(id, older);
      if (!page.ok) return setFailure(page.failure);
      setThread((current) => [...[...page.value.messages].reverse(), ...current]);
      setOlder(page.value.next);
    },
  };
}
