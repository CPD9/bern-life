"use client";

// A bell with the unread count; pressing it opens the list, newest first. Opening the list does not
// mark anything read: following a notification, or Mark all read, does. Escape closes the list and
// puts focus back on the bell, but only while focus is on the bell or in its list, so an Escape
// meant for something else on the page leaves the list alone.

import { useEffect, useId, useRef, useState } from "react";
import { formatBernTime, useNow } from "@/infrastructure/bern-time";
import { NotificationText } from "./notification-item";
import { type NotificationStore, unreadCount } from "./notification-store";
import { useNotifications } from "./use-notifications";
import { formatWhen } from "./when";

const BELL = "M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zm4 4h4M12 3v2";

export function bellLabel(unread: number): string {
  return unread === 0 ? "Notifications" : `Notifications, ${unread} unread`;
}

export function NotificationBell({ store, now }: { store: NotificationStore; now?: Date }) {
  const items = useNotifications(store);
  const clock = useNow();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const unread = unreadCount(items);
  const today = now ?? clock;

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (!(event.target instanceof Node && root.current?.contains(event.target))) return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        ref={button}
        type="button"
        aria-label={bellLabel(unread)}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen(!open)}
        className="rounded-pill bg-panel shadow-panel border-panel-border relative flex size-12 items-center justify-center border"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={BELL} />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="bg-primary text-primary-ink rounded-pill absolute -top-1 -right-1 min-w-5 px-1.5 text-xs leading-5 font-bold"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <section
          id={listId}
          aria-label="Notifications"
          className="bg-panel shadow-panel border-panel-border absolute right-0 z-10 mt-2 flex max-h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto rounded-3xl border p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold">Notifications</h2>
            <button
              type="button"
              onClick={() => store.markAllRead()}
              disabled={unread === 0}
              className="bg-chip rounded-pill px-3 py-1 text-sm font-bold disabled:opacity-60"
            >
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="text-muted text-sm">
              Nothing yet. Messages, new connections and changes your loops find show up here.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {items.map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read ? "" : "bg-primary"}`}
                  />
                  <NotificationText item={item} onOpen={() => store.markRead(item.id)} />
                  <span className="text-muted ml-auto shrink-0 text-xs">
                    {item.read ? null : <span className="sr-only">Unread, </span>}
                    <time dateTime={item.at}>
                      {today === null
                        ? formatBernTime(new Date(item.at))
                        : formatWhen(item.at, today)}
                    </time>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
