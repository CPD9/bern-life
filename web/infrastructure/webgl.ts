"use client";

// Whether this browser can draw the 3D scenes. three.js needs WebGL 2, so that is what is asked
// for, once: a throwaway canvas opens a context and releases it at once, since browsers cap how
// many contexts a page may hold. Unknown (null) on the server and while hydrating.

import { useSyncExternalStore } from "react";

type ProbeCanvas = { getContext(kind: "webgl2"): unknown };

/** True when a canvas from `makeCanvas` opens a WebGL 2 context; false when it cannot or throws. */
export function probeWebgl2(
  makeCanvas: () => ProbeCanvas = () => document.createElement("canvas"),
): boolean {
  try {
    const gl = makeCanvas().getContext("webgl2") as WebGL2RenderingContext | null;
    if (gl === null || gl === undefined) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

let offered: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  offered ??= probeWebgl2();
  return offered;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/**
 * Sets what the browser offers instead of asking it. For tests only: happy-dom offers no WebGL, so
 * the test setup says it does, and a test that needs the fallback says it does not.
 */
export function assumeWebgl(value: boolean): void {
  offered = value;
  for (const listener of listeners) listener();
}

export function useWebgl(): boolean | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
