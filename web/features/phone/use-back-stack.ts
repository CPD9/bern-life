"use client";

import { useEffect, useRef } from "react";

// The phone's history of open apps. The open app is owned by the caller (the world can open an
// app directly), so every change of appId is recorded here; Back pops to the app before, or home.
export function useBackStack(appId: string | null, onAppChange: (appId: string | null) => void) {
  const stack = useRef<(string | null)[]>([]);
  const shown = useRef<string | null>(appId);
  const goingBack = useRef(false);

  useEffect(() => {
    if (shown.current === appId) return;
    if (appId === null) stack.current = [];
    else if (!goingBack.current) stack.current.push(shown.current);
    goingBack.current = false;
    shown.current = appId;
  }, [appId]);

  return {
    back: (): void => {
      let previous = stack.current.pop() ?? null;
      while (previous !== null && previous === shown.current)
        previous = stack.current.pop() ?? null;
      goingBack.current = true;
      onAppChange(previous);
    },
    clear: (): void => {
      stack.current = [];
    },
  };
}
