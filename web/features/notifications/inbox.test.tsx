import { describe, expect, test } from "bun:test";
import { act, render, renderHook, screen } from "@testing-library/react";
import { type InboxApi, type InboxItem, createInbox, inboxApiOver } from "./inbox";
import { createNotificationStore } from "./notification-store";
import { Toasts } from "./toasts";
import { INBOX_POLL_MS, useInboxSync } from "./use-notifications";

function item(id: string, minute: number, title = `Note ${id}`): InboxItem {
  const at = `2026-10-19T08:${String(minute).padStart(2, "0")}:00.000Z`;
  return { id, kind: "message", title, body: "Open Messages to read it.", at, read: false };
}

function fakeServer(initial: InboxItem[] | null) {
  let items = initial;
  const reads: (readonly string[] | "all")[] = [];
  const api: InboxApi = {
    list: async () => (items === null ? null : items.map((entry) => ({ ...entry }))),
    read: async (ids) => {
      reads.push(ids);
    },
  };
  return { api, reads, set: (next: InboxItem[] | null) => (items = next) };
}

function setup(initial: InboxItem[] | null) {
  let count = 0;
  const storage = { getItem: () => null, setItem: () => {} };
  const local = createNotificationStore(() => storage, {
    newId: () => `local-${++count}`,
    now: () => new Date("2026-10-19T08:05:00Z"),
  });
  const server = fakeServer(initial);
  return { inbox: createInbox(local, server.api), server };
}

describe("createInbox", () => {
  test("lists the browser's own and the server's notifications together, newest first", async () => {
    const { inbox } = setup([item("s1", 1), item("s2", 9)]);
    inbox.notify({ kind: "loop", title: "Loop found 2 new", body: "Glucose" });
    await inbox.refresh();
    expect(inbox.list().map((n) => [n.id, n.earlier === true])).toEqual([
      ["s2", true],
      ["local-1", false],
      ["s1", true],
    ]);
    expect(inbox.list()).toBe(inbox.list());
  });

  test("marking read reaches the server for its own items only", async () => {
    const { inbox, server } = setup([item("s1", 1)]);
    inbox.notify({ kind: "loop", title: "Loop", body: "x" });
    await inbox.refresh();
    inbox.markRead("local-1");
    expect(server.reads).toEqual([]);
    inbox.markRead("s1");
    expect(server.reads).toEqual([["s1"]]);
    expect(inbox.list().every((n) => n.read)).toBe(true);
    inbox.markAllRead();
    expect(server.reads).toEqual([["s1"]]);
  });

  test("only what arrives after the first read pops up as a toast", async () => {
    const { inbox, server } = setup([item("s1", 1, "Ada asks to connect")]);
    render(<Toasts store={inbox} reducedMotion />);
    await act(async () => inbox.refresh());
    expect(screen.queryByText("Ada asks to connect")).toBeNull();
    server.set([item("s2", 7, "New message from Bea"), item("s1", 1, "Ada asks to connect")]);
    await act(async () => inbox.refresh());
    expect(screen.getByText("New message from Bea")).toBeTruthy();
    expect(screen.queryByText("Ada asks to connect")).toBeNull();
  });

  test("signed out, the server's part is empty", async () => {
    const { inbox, server } = setup([item("s1", 1)]);
    await inbox.refresh();
    server.set(null);
    await inbox.refresh();
    expect(inbox.list()).toEqual([]);
  });
});

describe("useInboxSync", () => {
  test("reads on mount and on each trigger, and polls only while signed in", () => {
    const calls: string[] = [];
    const polls: number[] = [];
    const inbox = { refresh: async () => void calls.push("refresh") };
    const schedule = (_run: () => void, ms: number) => {
      polls.push(ms);
      return () => {};
    };
    const { rerender } = renderHook(
      ({ signedIn, trigger }) => useInboxSync(signedIn, trigger, inbox, schedule),
      { initialProps: { signedIn: false, trigger: 0 } },
    );
    expect([calls.length, polls]).toEqual([1, []]);
    rerender({ signedIn: true, trigger: 0 });
    rerender({ signedIn: true, trigger: 2 });
    expect([calls.length, polls]).toEqual([3, [INBOX_POLL_MS]]);
  });
});

describe("inboxApiOver", () => {
  test("lists from the route, null when refused, and posts reads", async () => {
    const sent: [string, string | undefined, unknown][] = [];
    const api = inboxApiOver(async (path, init) => {
      sent.push([path, init.method, init.body ?? null]);
      return path === "/api/notifications"
        ? new Response(null, { status: 401 })
        : new Response(null, { status: 204 });
    });
    expect(await api.list()).toBeNull();
    await api.read(["n1"]);
    await api.read("all");
    expect(sent).toEqual([
      ["/api/notifications", "GET", null],
      ["/api/notifications/read", "POST", '{"ids":["n1"]}'],
      ["/api/notifications/read", "POST", '{"all":true}'],
    ]);
  });
});
