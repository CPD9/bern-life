// In-app notifications this browser raises itself: a loop found a change, or the app has something
// to say. Messages and connections come from the server and join these in inbox.ts. These live in
// localStorage, newest first and capped, so an old visit cannot grow the list forever. Storage can be missing or throw (private windows, blocked site data), so
// every access is guarded and memory is the fallback. Nothing leaves the browser: no email, no
// web push, no service worker.

export const notificationKinds = ["message", "connection", "loop", "system"] as const;

export type NotificationKind = (typeof notificationKinds)[number];

export type AppNotification = {
  readonly id: string;
  readonly kind: NotificationKind;
  readonly title: string;
  readonly body: string;
  /** ISO 8601 instant. */
  readonly at: string;
  readonly read: boolean;
  /** One of the app's own pages, never another site. */
  readonly href?: string;
  /** Already waiting when this visit began: listed in the bell, never popped up as a toast. */
  readonly earlier?: boolean;
};

export type NewNotification = Pick<AppNotification, "kind" | "title" | "body" | "href">;

export type NotificationStore = {
  list(): readonly AppNotification[];
  notify(input: NewNotification): AppNotification;
  markRead(id: string): void;
  markAllRead(): void;
  subscribe(listener: () => void): () => void;
};

export const notificationsKey = "bernlife.notifications";

export const NOTIFICATION_CAP = 50;

type NotificationStorage = Pick<Storage, "getItem" | "setItem">;

type Options = {
  readonly now?: () => Date;
  readonly newId?: () => string;
  readonly cap?: number;
};

// A path on this site: starts with one slash, and no second slash or backslash that a browser
// would read as another host. Browsers drop tab, CR and LF anywhere in a URL, so "/\t/evil.example"
// would become "//evil.example": whitespace and control characters are refused too.
export function isAppPath(href: string): boolean {
  return /^\/(?![/\\])/.test(href) && ![...href].some(isUnsafeChar);
}

function isUnsafeChar(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return char === "\\" || code <= 0x20 || code === 0x7f || /\s/.test(char);
}

function parseOne(value: unknown): AppNotification | null {
  if (typeof value !== "object" || value === null) return null;
  const { id, kind, title, body, at, read, href } = value as Record<string, unknown>;
  const known = notificationKinds.find((name) => name === kind);
  if (typeof id !== "string" || known === undefined) return null;
  if (typeof title !== "string" || typeof body !== "string" || typeof read !== "boolean") {
    return null;
  }
  if (typeof at !== "string" || Number.isNaN(Date.parse(at))) return null;
  const link = typeof href === "string" && isAppPath(href) ? { href } : {};
  return { id, kind: known, title, body, at, read, ...link };
}

// Stable: two notifications from the same instant keep the order they were stored in.
function newestFirst(a: AppNotification, b: AppNotification): number {
  return Date.parse(b.at) - Date.parse(a.at);
}

export function parseNotifications(raw: string | null, cap = NOTIFICATION_CAP): AppNotification[] {
  if (raw === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  return value
    .map(parseOne)
    .filter((item): item is AppNotification => item !== null)
    .sort(newestFirst)
    .slice(0, cap);
}

export function unreadCount(items: readonly AppNotification[]): number {
  return items.filter((item) => !item.read).length;
}

export function createNotificationStore(
  storage: () => NotificationStorage,
  {
    now = () => new Date(),
    newId = () => crypto.randomUUID(),
    cap = NOTIFICATION_CAP,
  }: Options = {},
): NotificationStore {
  let items: readonly AppNotification[];
  try {
    items = parseNotifications(storage().getItem(notificationsKey), cap);
  } catch {
    items = [];
  }
  const listeners = new Set<() => void>();

  function commit(next: readonly AppNotification[]) {
    items = next;
    try {
      storage().setItem(notificationsKey, JSON.stringify(next));
    } catch {
      // Kept in memory for this visit only.
    }
    for (const listener of listeners) listener();
  }

  return {
    list: () => items,
    notify: ({ kind, title, body, href }) => {
      const link = href !== undefined && isAppPath(href) ? { href } : {};
      const item: AppNotification = {
        id: newId(),
        kind,
        title,
        body,
        at: now().toISOString(),
        read: false,
        ...link,
      };
      commit([item, ...items].slice(0, cap));
      return item;
    },
    markRead: (id) => {
      if (!items.some((item) => item.id === id && !item.read)) return;
      commit(items.map((item) => (item.id === id ? { ...item, read: true } : item)));
    },
    markAllRead: () => {
      if (unreadCount(items) === 0) return;
      commit(items.map((item) => (item.read ? item : { ...item, read: true })));
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
