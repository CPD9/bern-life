"use client";

import { useRef } from "react";
import type { NumbersState } from "@/infrastructure/use-numbers";

function sentence(state: NumbersState): string {
  switch (state.status) {
    case "loading":
      return "Loading Bern Life’s numbers.";
    case "not_connected":
      return "Bern Life’s numbers are not connected yet.";
    case "error":
      return "Bern Life’s numbers could not be loaded.";
    case "ok":
      return state.numbers.eval === null
        ? "The evaluator has not run on this snapshot."
        : `Numbers for snapshot ${state.numbers.snapshot}.`;
  }
}

// One live line says where the skills' numbers are, so a screen reader hears them arrive or fail,
// and an error offers Try again. Try again unmounts its own button, so focus moves to the line.
export function NumbersStatus({ state, onRetry }: { state: NumbersState; onRetry: () => void }) {
  const line = useRef<HTMLDivElement>(null);
  return (
    <div ref={line} tabIndex={-1} aria-live="polite" className="flex flex-col items-start gap-2">
      <p className="text-muted text-sm">{sentence(state)}</p>
      {state.status === "error" && (
        <button
          type="button"
          onClick={() => {
            line.current?.focus();
            onRetry();
          }}
          className="bg-primary text-primary-ink rounded-pill px-5 py-2 font-bold"
        >
          Try again
        </button>
      )}
    </div>
  );
}
