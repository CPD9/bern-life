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

const noChange = () => () => undefined;

// Settling after onboarding: the card and the quest's "Show me" open the dialog; choosing a plot
// stores it on this device and reports `settled` to the story.
export function useWorldSettle(
  events: AppEventSink,
  store: () => SettleStore = browserSettleStore,
): WorldSettle {
  const stored = useSyncExternalStore(
    noChange,
    () => store().get(),
    () => null,
  );
  const [chosen, setChosen] = useState<Plot | null>(null);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  function settled(plot: Plot) {
    setChosen(plot);
    events.emit("settled");
  }

  return {
    plot: chosen ?? stored,
    dismissed,
    open: () => setOpen(true),
    dismiss: () => setDismissed(true),
    dialog: open && (
      <Settle places={PLACES} store={store()} onSettled={settled} onClose={() => setOpen(false)} />
    ),
  };
}
