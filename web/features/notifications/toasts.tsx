"use client";

// New notifications pop up as toasts in a polite live region, so a screen reader hears them
// without losing its place. Each toast leaves by itself after a few seconds; under the OS
// reduce-motion setting nothing moves or vanishes on its own, so toasts stay until dismissed. A
// toast under the pointer or keyboard focus waits too, so nobody loses one mid-sentence; the two
// holds are kept apart, so moving the pointer away does not cut short a toast read by keyboard.
// Dismissing only hides the toast: the notification stays in the bell until it is read. Focus on
// a dismissed toast moves to the next one, or back to where it was before it entered the toasts.

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

/** Focus that moves to another element inside `element` has not left it. */
function leaves(element: HTMLElement, event: Event): boolean {
  const to = (event as FocusEvent).relatedTarget;
  return !(to instanceof Node && element.contains(to));
}

function Toast({
  item,
  stays,
  schedule,
  onDismiss,
  onClose,
  onOpen,
  dismissRef,
}: {
  item: AppNotification;
  stays: boolean;
  schedule: After;
  onDismiss: (id: string) => void;
  onClose: (id: string, button: HTMLButtonElement) => void;
  onOpen: () => void;
  dismissRef: (element: HTMLButtonElement | null) => void;
}) {
  const { id } = item;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const card = useRef<HTMLLIElement>(null);
  // The card is a list item, not a control, so it listens natively for the pointer or focus
  // entering anywhere inside it.
  useEffect(() => {
    const element = card.current;
    if (element === null) return;
    const events = [
      ["pointerenter", () => setHovered(true)],
      ["pointerleave", () => setHovered(false)],
      ["focusin", () => setFocused(true)],
      [
        "focusout",
        (event: Event) => {
          if (leaves(element, event)) setFocused(false);
        },
      ],
    ] as const;
    for (const [name, listener] of events) element.addEventListener(name, listener);
    return () => {
      for (const [name, listener] of events) element.removeEventListener(name, listener);
    };
  }, []);
  const held = hovered || focused;
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
        ref={dismissRef}
        type="button"
        aria-label={`Dismiss ${item.title}`}
        onClick={(event) => onClose(id, event.currentTarget)}
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
  const region = useRef<HTMLElement>(null);
  const dismissButtons = useRef(new Map<string, HTMLButtonElement>());
  const returnTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let seen = new Set(store.list().map((item) => item.id));
    return store.subscribe(() => {
      const items = store.list();
      const fresh = items.filter((item) => !seen.has(item.id) && !item.read);
      seen = new Set(items.map((item) => item.id));
      if (fresh.length > 0) setShown((current) => [...fresh, ...current].slice(0, MAX_TOASTS));
    });
  }, [store]);

  // Remembers where focus came from when it enters the toasts, to give it back after the last one.
  useEffect(() => {
    const element = region.current;
    if (element === null) return;
    const remember = (event: FocusEvent) => {
      const from = event.relatedTarget;
      if (from instanceof HTMLElement && !element.contains(from)) returnTo.current = from;
    };
    element.addEventListener("focusin", remember);
    return () => element.removeEventListener("focusin", remember);
  }, []);

  const dismiss = useCallback(
    (id: string) => setShown((current) => current.filter((item) => item.id !== id)),
    [],
  );

  function close(id: string, button: HTMLButtonElement) {
    if (document.activeElement === button) {
      const index = shown.findIndex((item) => item.id === id);
      const neighbour = shown[index + 1] ?? shown[index - 1];
      const next = neighbour === undefined ? undefined : dismissButtons.current.get(neighbour.id);
      const target = next ?? returnTo.current;
      if (target?.isConnected) target.focus();
    }
    dismiss(id);
  }

  return (
    <section
      ref={region}
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
              onClose={close}
              onOpen={() => {
                store.markRead(item.id);
                dismiss(item.id);
              }}
              dismissRef={(element) => {
                if (element) dismissButtons.current.set(item.id, element);
                else dismissButtons.current.delete(item.id);
              }}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}
