// In walk mode the arrows and W A S D move you instead of the map, for as long as they are held;
// Q and E still turn the view, and plus and minus still zoom it.

const STEER: Readonly<Record<string, readonly [right: number, forward: number]>> = {
  ArrowUp: [0, 1],
  w: [0, 1],
  ArrowDown: [0, -1],
  s: [0, -1],
  ArrowLeft: [-1, 0],
  a: [-1, 0],
  ArrowRight: [1, 0],
  d: [1, 0],
};

/** The key as the held set stores it, or null when it does not walk. */
export function walkKey(key: string): string | null {
  const name = key.length === 1 ? key.toLowerCase() : key;
  return name in STEER ? name : null;
}

/** Opposite keys cancel; two keys at right angles walk the diagonal. */
export function heldSteer(held: ReadonlySet<string>): { right: number; forward: number } {
  let right = 0;
  let forward = 0;
  for (const key of held) {
    const [r, f] = STEER[key] ?? [0, 0];
    right += r;
    forward += f;
  }
  return { right: Math.sign(right), forward: Math.sign(forward) };
}

export type HeldKeys = {
  press(key: string): void;
  release(key: string): void;
  clear(): void;
};
