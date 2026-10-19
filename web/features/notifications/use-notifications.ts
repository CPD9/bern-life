"use client";

// One notification store per browser tab. Code that wants to tell the player something calls
// `notificationStore().notify(...)`; the bell and the toasts read the same store, which also holds
// what the server keeps for a signed-in member (inbox.ts), read again by `useInboxSync`.
//
// To wire it in (the shell owns where it sits):
//   <NotificationBell store={notificationStore()} />   in the HUD, next to the clock
//   <Toasts store={notificationStore()} />             once, near the root of the world app
// A feature does not import another feature, so the app composes these and passes `notify` down
// to the messages, connections or agent loops that raise notifications.

import { useEffect, useSyncExternalStore } from "react";
import { type Inbox, createInbox, inboxApiOver } from "./inbox";
import {
  type AppNotification,
  type NotificationStore,
  createNotificationStore,
} from "./notification-store";

let store: Inbox | undefined;

export function notificationStore(): Inbox {
  store ??= createInbox(
    createNotificationStore(() => window.localStorage),
    inboxApiOver((path, init) => fetch(path, init)),
  );
  return store;
}

/** How often the server's notifications are read again while nothing else asks for them. */
export const INBOX_POLL_MS = 30_000;

type Refreshable = Pick<Inbox, "refresh">;
type Every = (run: () => void, ms: number) => () => void;

const every: Every = (run, ms) => {
  const timer = setInterval(run, ms);
  return () => clearInterval(timer);
};

/**
 * Reads the server's notifications when the account changes, when `trigger` changes (the unread
 * message count, which the live stream moves), and every 30 seconds for connection requests.
 */
export function useInboxSync(
  signedIn: boolean,
  trigger: unknown,
  inbox: Refreshable = notificationStore(),
  schedule: Every = every,
): void {
  useEffect(() => {
    void inbox.refresh();
  }, [inbox, signedIn, trigger]);
  useEffect(
    () => (signedIn ? schedule(() => void inbox.refresh(), INBOX_POLL_MS) : undefined),
    [inbox, signedIn, schedule],
  );
}

const none: readonly AppNotification[] = [];

export function useNotifications(source: NotificationStore): readonly AppNotification[] {
  return useSyncExternalStore(
    (listener) => source.subscribe(listener),
    () => source.list(),
    () => none,
  );
}
