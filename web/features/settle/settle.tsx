"use client";

// Choose where your office stands. A native modal dialog, so the world behind it is inert and
// Escape closes it; it opens on mount and gives focus back to whatever opened it. Each plot lists
// the nearest places with their sourced addresses; there is nothing to pay and nothing to rent.
// Confirming a plot stores it on this device and reports it once; the same plot again is no news.
// The stored plot is read as an external store with nothing stored on the server, so the first
// render in the browser matches the server's and the stored plot arrives just after.

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { NearbyList } from "./nearby-list";
import { type MapPlace, nearbyPlaces } from "./nearby";
import { FIRST_PLOT, type Plot, type PlotId, PLOTS, plotById } from "./plots";
import { PlotChoice } from "./plot-choice";
import { browserSettleStore, type SettleStore } from "./settle-store";

type SettleProps = {
  /** The places on the map (the world's places.json), passed in by app/. */
  places: readonly MapPlace[];
  onSettled: (plot: Plot) => void;
  onClose: () => void;
  store?: SettleStore;
};

export function Settle({ places, onSettled, onClose, store = browserSettleStore() }: SettleProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const settled = useSyncExternalStore(store.subscribe, store.get, () => null);
  const [chosenId, setChosenId] = useState<PlotId | null>(null);
  const chosen = plotById(chosenId) ?? settled ?? FIRST_PLOT;
  const nearby = useMemo(() => nearbyPlaces(chosen, places), [chosen, places]);
  const settledHere = settled?.id === chosen.id;

  useEffect(() => {
    const element = dialog.current;
    if (!element || element.open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
  }, []);

  function handleClose() {
    onClose();
    opener.current?.focus();
  }

  function settle() {
    if (store.get()?.id === chosen.id) return;
    store.set(chosen);
    onSettled(chosen);
  }

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={handleClose}
      className="bg-panel text-ink m-auto w-[min(36rem,calc(100vw-2rem))] rounded-3xl p-0 backdrop:bg-black/40"
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 id={titleId} className="text-xl font-extrabold">
              Choose where to settle
            </h2>
            <p className="text-muted text-sm">
              Pick a plot for your office and see which places are near it.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="bg-chip rounded-pill px-4 py-1.5 text-sm font-bold"
          >
            Close
          </button>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-4">
          <PlotChoice
            plots={PLOTS}
            value={chosen.id}
            settledId={settled?.id ?? null}
            onChange={setChosenId}
          />
          <NearbyList places={nearby} district={chosen.district} />
        </div>
        <div className="border-panel-border flex flex-wrap items-center justify-end gap-3 border-t px-5 py-3">
          <p aria-live="polite" className="text-muted mr-auto text-sm font-bold">
            {settled !== null && `Your office is in ${settled.district}.`}
          </p>
          <button
            type="button"
            aria-disabled={settledHere}
            onClick={settle}
            className="bg-primary text-primary-ink rounded-pill aria-disabled:bg-chip aria-disabled:text-ink px-5 py-2 font-extrabold aria-disabled:cursor-default"
          >
            {settledHere ? "Your office is here" : `Settle in ${chosen.district}`}
          </button>
        </div>
      </div>
    </dialog>
  );
}
