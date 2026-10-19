"use client";

import { useMemo } from "react";
import { type Connect, connectLive } from "@/features/messages/live-client";
import { type MessagesApi, httpMessagesApi } from "@/features/messages/messages-api";
import { useUnreadCount } from "@/features/messages/use-unread-count";

// Signed out there is nothing to count, so nothing is fetched and no stream is opened.
const signedOutApi: MessagesApi = {
  ...httpMessagesApi,
  unread: async () => ({ ok: false, failure: "unauthenticated" }),
};
const noStream: Connect = () => () => undefined;

/**
 * Unread messages for the Phone tab and the desk's Messages; null when signed out. Reading a
 * thread sends no live notice, so the count is read again whenever `refresh` changes, such as
 * when the phone or the desk closes: a fresh stream makes the counter fetch once more.
 */
export function useUnreadMessages(
  signedIn: boolean,
  refresh: string | number | boolean = 0,
  api: MessagesApi = httpMessagesApi,
  connect: Connect = connectLive,
): number | null {
  const stream = useMemo<Connect>(
    () => (signedIn ? (onNotice, onDown) => connect(onNotice, onDown) : noStream),
    // `refresh` is listed on purpose: a new stream identity is what makes the counter re-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signedIn, connect, refresh],
  );
  const unread = useUnreadCount(signedIn ? api : signedOutApi, stream);
  return signedIn ? unread : null;
}
