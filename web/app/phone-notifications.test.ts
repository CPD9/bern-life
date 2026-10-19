import { expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { createNotificationStore } from "@/features/notifications/notification-store";
import { usePhoneNotifications } from "./phone-notifications";

function memoryStore() {
  const items = new Map<string, string>();
  let count = 0;
  return createNotificationStore(
    () => ({
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
    }),
    { now: () => new Date(Date.UTC(2026, 9, 19, 9, count)), newId: () => `n${++count}` },
  );
}

test("following a notification marks it read and opens its app; others only mark it read", () => {
  const store = memoryStore();
  store.notify({ kind: "message", title: "Demo message", body: "From demo-anna." });
  store.notify({ kind: "loop", title: "Demo loop", body: "One new result." });
  store.notify({ kind: "system", title: "Demo notice", body: "Hello." });
  const opened: string[] = [];
  const { result } = renderHook(() => usePhoneNotifications((id) => opened.push(id), store));
  for (const notification of result.current.notifications) {
    act(() => result.current.onOpenNotification(notification));
  }
  // Newest first: the notice, the loop, the message.
  expect(opened).toEqual(["agents", "messages"]);
  expect(result.current.notifications.map((n) => n.read)).toEqual([true, true, true]);
});

test("Mark all read reads the store's every notification", () => {
  const store = memoryStore();
  store.notify({ kind: "message", title: "Demo message", body: "From demo-anna." });
  const { result } = renderHook(() => usePhoneNotifications(() => undefined, store));
  expect(result.current.notifications.map((n) => n.read)).toEqual([false]);
  act(() => result.current.onMarkAllRead());
  expect(result.current.notifications.map((n) => n.read)).toEqual([true]);
});
