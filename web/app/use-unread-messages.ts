"use client";

import { type Connect, connectLive } from "@/features/messages/live-client";
import { type MessagesApi, httpMessagesApi } from "@/features/messages/messages-api";
import { useUnreadCount } from "@/features/messages/use-unread-count";

// Signed out there is nothing to count, so nothing is fetched and no stream is opened.
const signedOutApi: MessagesApi = {
  ...httpMessagesApi,
  unread: async () => ({ ok: false, failure: "unauthenticated" }),
};
const noStream: Connect = () => () => undefined;

/** Unread messages for the Phone tab and the desk's Messages; null when signed out. */
export function useUnreadMessages(signedIn: boolean): number | null {
  const unread = useUnreadCount(
    signedIn ? httpMessagesApi : signedOutApi,
    signedIn ? connectLive : noStream,
  );
  return signedIn ? unread : null;
}
