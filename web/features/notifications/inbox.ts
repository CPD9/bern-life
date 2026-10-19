// The bell's one list: notifications this browser raised itself (a loop's news) and those the
// server keeps for a signed-in member (a message arrived, someone asked to connect). Both read
// and mark the same way. What the server already held when this visit began is marked `earlier`,
// so it waits in the bell instead of popping up as a toast. Signed out, the server part is empty.
import type { AppNotification, NotificationStore } from "./notification-store";

/** What GET /api/notifications lists: names and fixed words only, never a message's text. */
export type InboxItem = Pick<AppNotification, "id" | "title" | "body" | "at" | "read"> & {
  kind: "message" | "connection";
};

export type InboxApi = {
  /** Null when signed out or unreachable. */
  list(): Promise<InboxItem[] | null>;
  read(ids: readonly string[] | "all"): Promise<void>;
};

export type Inbox = NotificationStore & {
  /** Reads the server's list again. */
  refresh(): Promise<void>;
};

function newestFirst(a: AppNotification, b: AppNotification): number {
  return Date.parse(b.at) - Date.parse(a.at);
}

export function createInbox(local: NotificationStore, api: InboxApi): Inbox {
  let server: readonly AppNotification[] = [];
  let loaded = false;
  let merged: readonly AppNotification[] = local.list();
  let mergedFrom: readonly AppNotification[] = local.list();
  const listeners = new Set<() => void>();

  function changed() {
    for (const listener of listeners) listener();
  }

  function list(): readonly AppNotification[] {
    const own = local.list();
    if (own !== mergedFrom) {
      mergedFrom = own;
      merged = [...server, ...own].sort(newestFirst);
    }
    return merged;
  }

  function setServer(next: readonly AppNotification[]) {
    server = next;
    merged = [...server, ...local.list()].sort(newestFirst);
    mergedFrom = local.list();
    changed();
  }

  function markServerRead(ids: ReadonlySet<string>) {
    setServer(server.map((item) => (ids.has(item.id) ? { ...item, read: true } : item)));
  }

  return {
    list,
    notify: (input) => local.notify(input),
    markRead: (id) => {
      if (server.some((item) => item.id === id && !item.read)) {
        markServerRead(new Set([id]));
        void api.read([id]);
      } else local.markRead(id);
    },
    markAllRead: () => {
      local.markAllRead();
      if (!server.some((item) => !item.read)) return;
      markServerRead(new Set(server.map((item) => item.id)));
      void api.read("all");
    },
    subscribe: (listener) => {
      listeners.add(listener);
      const stopLocal = local.subscribe(listener);
      return () => {
        listeners.delete(listener);
        stopLocal();
      };
    },
    refresh: async () => {
      const items = await api.list();
      const before = new Map(server.map((item) => [item.id, item]));
      const next = (items ?? []).map((item) => {
        const earlier = !loaded || before.get(item.id)?.earlier === true;
        return earlier ? { ...item, earlier: true } : item;
      });
      loaded = items !== null;
      const same =
        next.length === server.length &&
        next.every((item, index) => {
          const held = server[index];
          return held?.id === item.id && held.read === item.read && held.title === item.title;
        });
      if (!same) setServer(next);
    },
  };
}

export function inboxApiOver(
  send: (path: string, init: RequestInit) => Promise<Response>,
): InboxApi {
  return {
    list: async () => {
      try {
        const response = await send("/api/notifications", { method: "GET" });
        if (!response.ok) return null;
        return ((await response.json()) as { notifications: InboxItem[] }).notifications;
      } catch {
        return null;
      }
    },
    read: async (ids) => {
      const body = ids === "all" ? { all: true } : { ids };
      await send("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => undefined);
    },
  };
}
