// How the turntable answers keys and drags, kept free of three.js so it can be tested with Bun.

export const KEY_STEP_DEGREES = 15;
export const RADIANS_PER_PIXEL = 0.012;

const STEP = (KEY_STEP_DEGREES * Math.PI) / 180;

/** The angle after a key press, or null when the key does not turn the figure. */
export function angleAfterKey(angle: number, key: string): number | null {
  if (key === "ArrowLeft") return angle - STEP;
  if (key === "ArrowRight") return angle + STEP;
  if (key === "Home") return 0;
  return null;
}

/** Whole degrees in 0–359, for the slider's value. */
export function degreesOf(radians: number): number {
  const degrees = Math.round((radians * 180) / Math.PI) % 360;
  return degrees < 0 ? degrees + 360 : degrees;
}

export function turnLabel(degrees: number): string {
  return degrees === 0 ? "Facing you" : `Turned ${degrees} degrees`;
}
