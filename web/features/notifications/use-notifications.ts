"use client";

// One notification store per browser tab. Code that wants to tell the player something calls
// `notificationStore().notify(...)`; the bell and the toasts read the same store.
//
// To wire it in (the shell owns where it sits):
//   <NotificationBell store={notificationStore()} />   in the HUD, next to the clock
//   <Toasts store={notificationStore()} />             once, near the root of the world app
// A feature does not import another feature, so the app composes these and passes `notify` down
// to the messages, connections or agent loops that raise notifications.

import { useSyncExternalStore } from "react";
import {
  type AppNotification,
  type NotificationStore,
  createNotificationStore,
} from "./notification-store";

let store: NotificationStore | undefined;

export function notificationStore(): NotificationStore {
  store ??= createNotificationStore(() => window.localStorage);
  return store;
}

const none: readonly AppNotification[] = [];

export function useNotifications(source: NotificationStore): readonly AppNotification[] {
  return useSyncExternalStore(
    (listener) => source.subscribe(listener),
    () => source.list(),
    () => none,
  );
}
