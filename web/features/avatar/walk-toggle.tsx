// The turntable's Walk button. Under the OS reduce-motion setting the bear stands still whatever
// is pressed, so the button says it is unavailable and why, instead of doing nothing. It stays in
// the tab order (aria-disabled, not disabled), so keyboard and screen-reader users reach the note.

import { useCallback, useId, useState } from "react";

type WalkToggleProps = { walking: boolean; reducedMotion: boolean; onToggle: () => void };

export function WalkToggle({ walking, reducedMotion, onToggle }: WalkToggleProps) {
  const noteId = useId();
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-pressed={walking && !reducedMotion}
        aria-disabled={reducedMotion}
        aria-describedby={reducedMotion ? noteId : undefined}
        onClick={reducedMotion ? undefined : onToggle}
        className="bg-chip rounded-pill aria-pressed:bg-chip-selected aria-pressed:text-chip-selected-ink px-3 py-1 text-sm font-bold aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
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

/**
 * Whether Walk is on. Reduced motion switches it off, so turning the setting off again later does
 * not set the bear walking by surprise.
 */
export function useWalking(reducedMotion: boolean): [walking: boolean, toggle: () => void] {
  const [walking, setWalking] = useState(false);
  const [wasReduced, setWasReduced] = useState(reducedMotion);
  if (reducedMotion !== wasReduced) {
    setWasReduced(reducedMotion);
    if (reducedMotion) setWalking(false);
  }
  const toggle = useCallback(() => setWalking((on) => !on), []);
  return [walking, toggle];
}
