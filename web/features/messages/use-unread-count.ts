"use client";

import { useEffect, useState } from "react";
import { type Connect, POLL_MS } from "./live-client";
import type { MessagesApi } from "./messages-api";
import { type Every, every } from "./use-messages";

/** The unread count for the Messages icon: null when signed out, so the phone shows no badge. */
export function useUnreadCount(
  api: MessagesApi,
  connect: Connect,
  schedule: Every = every,
): number | null {
  const [unread, setUnread] = useState<number | null>(null);

  useEffect(() => {
    const read = () => api.unread().then((outcome) => setUnread(outcome.ok ? outcome.value : null));
    void read();
    let stopPolling = () => {};
    const stopLive = connect(
      () => void read(),
      () => {
        stopPolling = schedule(() => void read(), POLL_MS);
      },
    );
    return () => {
      stopLive();
      stopPolling();
    };
  }, [api, connect, schedule]);

  return unread;
}
