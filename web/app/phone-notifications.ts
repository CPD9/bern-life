"use client";

import type { NotificationStore } from "@/features/notifications/notification-store";
import { notificationStore, useNotifications } from "@/features/notifications/use-notifications";
import type { PhoneNotification } from "@/features/phone/phone";

/** Where following a notification goes in the phone; others only mark it read. */
const appFor: Readonly<Record<string, string>> = { message: "messages", loop: "agents" };

// The phone's notification centre reads the same store as the bell and the toasts.
export function usePhoneNotifications(
  openApp: (appId: string) => void,
  store: NotificationStore = notificationStore(),
) {
  return {
    notifications: useNotifications(store),
    onOpenNotification: (notification: PhoneNotification) => {
      store.markRead(notification.id);
      const appId = appFor[notification.kind];
      if (appId !== undefined) openApp(appId);
    },
    onMarkAllRead: () => store.markAllRead(),
  };
}
