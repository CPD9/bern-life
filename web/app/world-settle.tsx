"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";
import type { Plot } from "@/features/settle/plots";
import { Settle } from "@/features/settle/settle";
import { type SettleStore, browserSettleStore } from "@/features/settle/settle-store";
import { PLACES } from "@/features/world/places";
import type { AppEventSink } from "@/infrastructure/app-events";

export type WorldSettle = {
  /** The plot chosen on this device; null before settling, and while the page hydrates. */
  plot: Plot | null;
  dismissed: boolean;
  open: () => void;
  dismiss: () => void;
  /** The settle dialog while it is open. */
  dialog: ReactNode;
};

type SettleOptions = {
  store?: () => SettleStore;
  /** Where focus goes when what opened the dialog is gone: settling replaces the card. */
  landing?: () => HTMLElement | null;
};

/** Once the page has settled, puts focus on `landing` if it fell to the page or went away. */
export function keepFocus(landing: (() => HTMLElement | null) | undefined): void {
  setTimeout(() => {
    const active = document.activeElement;
    if (active === null || active === document.body || !active.isConnected) landing?.()?.focus();
  }, 0);
}

// Settling after onboarding: the card and the quest's "Show me" open the dialog; choosing a plot
// stores it on this device and reports `settled` to the story.
export function useWorldSettle(
  events: AppEventSink,
  { store = browserSettleStore, landing }: SettleOptions = {},
): WorldSettle {
  const plot = useSyncExternalStore(
    (listener) => store().subscribe(listener),
    () => store().get(),
    () => null,
  );
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  return {
    plot,
    dismissed,
    open: () => setOpen(true),
    dismiss: () => {
      setDismissed(true);
      keepFocus(landing);
    },
    dialog: open && (
      <Settle
        places={PLACES}
        store={store()}
        onSettled={() => events.emit("settled")}
        onClose={() => {
          setOpen(false);
          keepFocus(landing);
        }}
      />
    ),
  };
}
