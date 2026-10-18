// How Lumi moves, as plain numbers for a moment in time, so the motion can be checked exactly
// without three.js. Idle, it bobs slowly, flutters and glows like a breathing ember. Listening, it
// leans towards you, glows brighter, opens its eyes wide and sends out a soft ripple. Under reduced
// motion it holds a fixed pose, but listening still looks different from idle.

export type FloatieState = "idle" | "listening";

export type FloatiePose = {
  /** Height above the resting point, in metres. */
  readonly lift: number;
  /** Tilt towards the viewer, in radians. */
  readonly lean: number;
  /** How far each wing is raised from flat, in radians. */
  readonly wings: number;
  /** Brightness of the core, 1 at rest. */
  readonly glow: number;
  /** Size of the halo around the core, 1 at rest. */
  readonly halo: number;
  /** Eye height, 1 open, above 1 wide, close to 0 mid-blink. */
  readonly eyes: number;
  /** The listening ring: its size and how visible it is (0 hides it). */
  readonly ripple: { readonly scale: number; readonly opacity: number };
};

const TAU = Math.PI * 2;
const BOB_SECONDS = 2.4;
const FLUTTER_PER_SECOND = 3;
const BLINK_EVERY_SECONDS = 3.6;
const BLINK_SECONDS = 0.16;
export const RIPPLE_SECONDS = 1.2;

const NO_RIPPLE = { scale: 1, opacity: 0 };
const LISTENING_LEAN = 0.18;
const LISTENING_GLOW = 1.6;
const LISTENING_HALO = 1.25;
const WIDE_EYES = 1.2;

export const RESTING: Readonly<Record<FloatieState, FloatiePose>> = {
  idle: { lift: 0, lean: 0, wings: 0.3, glow: 1, halo: 1, eyes: 1, ripple: NO_RIPPLE },
  listening: {
    lift: 0.02,
    lean: LISTENING_LEAN,
    wings: 0.45,
    glow: LISTENING_GLOW,
    halo: LISTENING_HALO,
    eyes: WIDE_EYES,
    ripple: { scale: 1.5, opacity: 0.3 },
  },
};

/** Eyes shut briefly once every few seconds, the same way on every visit. */
export function blinkAt(seconds: number): number {
  const sinceBlink = seconds % BLINK_EVERY_SECONDS;
  if (sinceBlink >= BLINK_SECONDS) return 1;
  return 0.1 + 0.9 * Math.abs(Math.cos((sinceBlink / BLINK_SECONDS) * Math.PI));
}

export function idlePose(seconds: number): FloatiePose {
  const bob = Math.sin((seconds / BOB_SECONDS) * TAU);
  return {
    lift: 0.04 * bob,
    lean: 0,
    wings: 0.3 + 0.35 * Math.sin(seconds * FLUTTER_PER_SECOND * TAU),
    glow: 1 + 0.1 * bob,
    halo: 1 + 0.05 * bob,
    eyes: blinkAt(seconds),
    ripple: NO_RIPPLE,
  };
}

export function listeningPose(seconds: number): FloatiePose {
  const ripple = (seconds % RIPPLE_SECONDS) / RIPPLE_SECONDS;
  return {
    lift: 0.02 + 0.02 * Math.sin((seconds / 1.6) * TAU),
    lean: LISTENING_LEAN,
    wings: 0.45 + 0.45 * Math.sin(seconds * FLUTTER_PER_SECOND * 1.7 * TAU),
    glow: LISTENING_GLOW,
    halo: LISTENING_HALO,
    eyes: WIDE_EYES * blinkAt(seconds),
    ripple: { scale: 1 + ripple, opacity: 0.5 * (1 - ripple) },
  };
}

export function poseAt(state: FloatieState, seconds: number, reducedMotion: boolean): FloatiePose {
  if (reducedMotion) return RESTING[state];
  return state === "listening" ? listeningPose(seconds) : idlePose(seconds);
}

/** Lumi listens when told to, or while the player points at it or has it focused. */
export function shownState(
  wanted: FloatieState,
  pointedAt: boolean,
  focused: boolean,
): FloatieState {
  return wanted === "listening" || pointedAt || focused ? "listening" : "idle";
}
