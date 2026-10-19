// The turntable's Walk button. Under the OS reduce-motion setting the bear stands still whatever
// is pressed, so the button is disabled and says why, instead of doing nothing.

import { useId } from "react";

type WalkToggleProps = { walking: boolean; reducedMotion: boolean; onToggle: () => void };

export function WalkToggle({ walking, reducedMotion, onToggle }: WalkToggleProps) {
  const noteId = useId();
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-pressed={walking && !reducedMotion}
        aria-describedby={reducedMotion ? noteId : undefined}
        disabled={reducedMotion}
        onClick={onToggle}
        className="bg-chip rounded-pill aria-pressed:bg-chip-selected aria-pressed:text-chip-selected-ink px-3 py-1 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-60"
      >
        Walk
      </button>
      {reducedMotion && (
        <p id={noteId} className="text-muted text-xs">
          Off while your device asks for reduced motion
        </p>
      )}
    </div>
  );
}
