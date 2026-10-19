"use client";

import { useEffect, useRef } from "react";

/** Calls `callback` the first time `when` is true, and never again while mounted. */
export function useOnce(when: boolean, callback: (() => void) | undefined): void {
  const done = useRef(false);
  useEffect(() => {
    if (!when || done.current) return;
    done.current = true;
    callback?.();
  }, [when, callback]);
}
