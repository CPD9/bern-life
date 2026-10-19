import { type SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";

// Idle means no pointer, key or wheel event reached the desktop for `delay`. The timer comes in as
// a scheduler, so a test fires it by hand instead of patching the clock.

export const screensaverDelay = 90_000;

export type Scheduler = (callback: () => void, delay: number) => () => void;

export const browserScheduler: Scheduler = (callback, delay) => {
  const id = window.setTimeout(callback, delay);
  return () => window.clearTimeout(id);
};

export function useIdle(enabled: boolean, delay: number, schedule: Scheduler) {
  const [idle, setIdle] = useState(false);
  const cancel = useRef<() => void>(() => undefined);
  const resting = useRef<HTMLElement | null>(null);

  const arm = useCallback(() => {
    cancel.current();
    cancel.current = schedule(() => {
      resting.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setIdle(true);
    }, delay);
  }, [schedule, delay]);

  useEffect(() => {
    if (!enabled) return;
    arm();
    return () => {
      cancel.current();
      setIdle(false);
    };
  }, [enabled, arm]);

  function wake(event: SyntheticEvent) {
    if (!enabled) return;
    if (idle) {
      // A press is left to its click, so the tap that wakes the desk presses nothing under it.
      if (event.type === "pointerdown") return;
      // Escape wakes the desk; it closes nothing and leaves nothing.
      if ("key" in event && event.key === "Escape") event.stopPropagation();
      setIdle(false);
      resting.current?.focus();
    }
    arm();
  }

  return { idle, wake };
}
