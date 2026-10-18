"use client";

// New notifications pop up as toasts in a polite live region, so a screen reader hears them
// without losing its place. Each toast leaves by itself after a few seconds; under the OS
// reduce-motion setting nothing moves or vanishes on its own, so toasts stay until dismissed. A
// toast under the pointer or keyboard focus waits too, so nobody loses one mid-sentence.
// Dismissing only hides the toast: the notification stays in the bell until it is read.

import { useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "@/infrastructure/use-reduced-motion";
import { NotificationText } from "./notification-item";
import type { AppNotification, NotificationStore } from "./notification-store";

export const TOAST_MS = 6000;

const MAX_TOASTS = 3;

export type After = (run: () => void, ms: number) => () => void;

export const after: After = (run, ms) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

function Toast({
  item,
  stays,
  schedule,
  onDismiss,
  onOpen,
}: {
  item: AppNotification;
  stays: boolean;
  schedule: After;
  onDismiss: (id: string) => void;
  onOpen: () => void;
}) {
  const { id } = item;
  const [held, setHeld] = useState(false);
  const card = useRef<HTMLLIElement>(null);
  // The card is a list item, not a control, so it listens natively for the pointer or focus
  // entering anywhere inside it.
  useEffect(() => {
    const element = card.current;
    if (element === null) return;
    const hold = () => setHeld(true);
    const release = () => setHeld(false);
    const events = [
      ["pointerenter", hold],
      ["pointerleave", release],
      ["focusin", hold],
      ["focusout", release],
    ] as const;
    for (const [name, listener] of events) element.addEventListener(name, listener);
    return () => {
      for (const [name, listener] of events) element.removeEventListener(name, listener);
    };
  }, []);
  useEffect(
    () => (stays || held ? undefined : schedule(() => onDismiss(id), TOAST_MS)),
    [stays, held, schedule, onDismiss, id],
  );
  return (
    <li
      ref={card}
      className="bg-panel shadow-panel border-panel-border pointer-events-auto flex items-start gap-3 rounded-3xl border p-4"
    >
      <NotificationText item={item} onOpen={onOpen} />
      <button
        type="button"
        aria-label={`Dismiss ${item.title}`}
        onClick={() => onDismiss(id)}
        className="bg-chip rounded-pill ml-auto shrink-0 px-3 py-1 text-sm font-bold"
      >
        Dismiss
      </button>
    </li>
  );
}

export function Toasts({
  store,
  schedule = after,
  reducedMotion,
}: {
  store: NotificationStore;
  schedule?: After;
  reducedMotion?: boolean;
}) {
  const systemReduced = useReducedMotion();
  const stays = reducedMotion ?? systemReduced;
  const [shown, setShown] = useState<readonly AppNotification[]>([]);

  useEffect(() => {
    let seen = new Set(store.list().map((item) => item.id));
    return store.subscribe(() => {
      const items = store.list();
      const fresh = items.filter((item) => !seen.has(item.id) && !item.read);
      seen = new Set(items.map((item) => item.id));
      if (fresh.length > 0) setShown((current) => [...fresh, ...current].slice(0, MAX_TOASTS));
    });
  }, [store]);

  const dismiss = useCallback(
    (id: string) => setShown((current) => current.filter((item) => item.id !== id)),
    [],
  );

  return (
    <section
      aria-label="New notifications"
      className="pointer-events-none fixed top-4 right-4 z-20 w-[min(22rem,calc(100vw-2rem))]"
    >
      <div role="status" aria-live="polite">
        <ol className="flex flex-col gap-2">
          {shown.map((item) => (
            <Toast
              key={item.id}
              item={item}
              stays={stays}
              schedule={schedule}
              onDismiss={dismiss}
              onOpen={() => {
                store.markRead(item.id);
                dismiss(item.id);
              }}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
