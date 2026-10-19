// On a phone the HUD wraps to two or three lines, and how many depends on the clock, the counts and
// the account. Whatever sits under it reads the measured bottom instead of guessing a height.

/** Calls `onBottom` with the HUD's bottom edge in px now and whenever its size changes. */
export type WatchHud = (hud: HTMLElement, onBottom: (bottom: number) => void) => () => void;

export const watchHud: WatchHud = (hud, onBottom) => {
  const measure = () => onBottom(Math.ceil(hud.getBoundingClientRect().bottom));
  measure();
  if (typeof ResizeObserver === "undefined") return () => undefined;
  const observer = new ResizeObserver(measure);
  observer.observe(hud);
  return () => observer.disconnect();
};
