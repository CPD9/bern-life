import { describe, expect, test } from "bun:test";
import {
  createNotificationStore,
  isAppPath,
  notificationsKey,
  parseNotifications,
  unreadCount,
} from "./notification-store";

function memoryStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

const throwing = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

// A clock that moves one minute per call and ids n1, n2, ... so every value is exact.
function fixedOptions(cap?: number) {
  let minute = 0;
  let count = 0;
  return {
    now: () => new Date(Date.UTC(2026, 9, 19, 9, minute++)),
    newId: () => `n${++count}`,
    ...(cap === undefined ? {} : { cap }),
  };
}

const loop = { kind: "loop", title: "Loop found 2 new labs", body: "Wound healing" } as const;
const message = { kind: "message", title: "Bea wrote", body: "See you at ARTORG" } as const;

describe("createNotificationStore", () => {
  test("notify puts the newest first and returns what it stored", () => {
    const store = createNotificationStore(() => memoryStorage(), fixedOptions());
    expect(store.notify(loop)).toEqual({
      id: "n1",
      ...loop,
      at: "2026-10-19T09:00:00.000Z",
      read: false,
    });
    store.notify(message);
    expect(store.list().map((item) => item.id)).toEqual(["n2", "n1"]);
  });

  test("the list keeps only the newest items up to the cap", () => {
    const store = createNotificationStore(() => memoryStorage(), fixedOptions(2));
    store.notify(loop);
    store.notify(message);
    store.notify({ kind: "system", title: "New snapshot", body: "Pages from 19 Oct" });
    expect(store.list().map((item) => item.id)).toEqual(["n3", "n2"]);
  });

  test("markRead marks one item, markAllRead the rest, and the count follows", () => {
    const store = createNotificationStore(() => memoryStorage(), fixedOptions());
    store.notify(loop);
    store.notify(message);
    store.notify(loop);
    store.markRead("n2");
    expect(store.list().map((item) => item.read)).toEqual([false, true, false]);
    expect(unreadCount(store.list())).toBe(2);
    store.markAllRead();
    expect(unreadCount(store.list())).toBe(0);
  });

  test("listeners hear changes, but not a markRead that changes nothing", () => {
    const store = createNotificationStore(() => memoryStorage(), fixedOptions());
    let heard = 0;
    const stop = store.subscribe(() => heard++);
    store.notify(loop);
    store.markRead("n1");
    store.markRead("n1");
    store.markRead("missing");
    store.markAllRead();
    expect(heard).toBe(2);
    stop();
    store.notify(loop);
    expect(heard).toBe(2);
  });

  test("the next visit reads back the same list, read state included", () => {
    const storage = memoryStorage();
    const first = createNotificationStore(() => storage, fixedOptions());
    first.notify(loop);
    first.notify(message);
    first.markRead("n1");
    expect(JSON.parse(storage.getItem(notificationsKey) ?? "[]")).toEqual(first.list());
    const next = createNotificationStore(() => storage, fixedOptions());
    expect(next.list()).toEqual(first.list());
  });

  test("blocked storage keeps notifications in memory and still notifies", () => {
    const store = createNotificationStore(() => throwing, fixedOptions());
    let heard = 0;
    store.subscribe(() => heard++);
    expect(store.list()).toEqual([]);
    store.notify(message);
    store.markRead("n1");
    expect(store.list()).toEqual([
      { id: "n1", ...message, at: "2026-10-19T09:00:00.000Z", read: true },
    ]);
    expect(heard).toBe(2);
  });

  test("a link to another site is dropped, the notification kept", () => {
    const store = createNotificationStore(() => memoryStorage(), fixedOptions());
    expect(store.notify({ ...message, href: "//evil.example" }).href).toBeUndefined();
    expect(store.notify({ ...message, href: "/navigator" }).href).toBe("/navigator");
  });
});

describe("parseNotifications", () => {
  const stored = (id: string, at: string) => ({ id, ...loop, at, read: false });

  test("corrupted storage reads as an empty list", () => {
    expect(parseNotifications("{not json")).toEqual([]);
    expect(parseNotifications(JSON.stringify({ id: "n1" }))).toEqual([]);
    expect(parseNotifications(null)).toEqual([]);
  });

  test("unknown kinds and broken entries are skipped, the rest sorted newest first", () => {
    const raw = JSON.stringify([
      stored("old", "2026-10-18T20:00:00.000Z"),
      { ...stored("odd", "2026-10-19T08:00:00.000Z"), kind: "payment" },
      { ...stored("bad", "not a date") },
      stored("new", "2026-10-19T08:30:00.000Z"),
    ]);
    expect(parseNotifications(raw).map((item) => item.id)).toEqual(["new", "old"]);
  });

  test("a stored link to another site is removed", () => {
    const raw = JSON.stringify([
      { ...stored("n1", "2026-10-19T08:00:00.000Z"), href: "https://evil.example" },
    ]);
    expect(parseNotifications(raw)[0]).toEqual(stored("n1", "2026-10-19T08:00:00.000Z"));
  });
});

describe("isAppPath", () => {
  test("only paths on this site pass", () => {
    expect(["/", "/navigator", "/start?step=2"].map(isAppPath)).toEqual([true, true, true]);
    expect(
      ["//evil.example", "/\\evil.example", "https://evil.example", "javascript:alert(1)", ""].map(
        isAppPath,
      ),
    ).toEqual([false, false, false, false, false]);
  });
});
