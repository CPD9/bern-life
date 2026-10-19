"use client";

import { useState } from "react";

// The phone's history of open apps. The open app is owned by the caller (the world can open an
// app directly), so every change of appId is recorded here; Back pops to the app before, or home.
// The record is derived during render, so the title of where Back leads is right on the first
// frame of a new app, never a frame late.
type History = { readonly shown: string | null; readonly stack: readonly (string | null)[] };

/** Where Back leads: the newest entry that is not the open app itself; null is home. */
function destination(stack: readonly (string | null)[], current: string | null): string | null {
  for (let index = stack.length - 1; index >= 0; index -= 1) {
    const entry = stack[index] ?? null;
    if (entry !== current) return entry;
  }
  return null;
}

export function useBackStack(appId: string | null, onAppChange: (appId: string | null) => void) {
  const [history, setHistory] = useState<History>({ shown: appId, stack: [] });
  if (history.shown !== appId) {
    setHistory({
      shown: appId,
      stack: appId === null ? [] : [...history.stack, history.shown],
    });
  }

  return {
    /** The app Back returns to, null for home. */
    previous: destination(history.stack, appId),
    back: (): void => {
      const stack = [...history.stack];
      let previous = stack.pop() ?? null;
      while (previous !== null && previous === appId) previous = stack.pop() ?? null;
      setHistory({ shown: previous, stack });
      onAppChange(previous);
    },
    clear: (): void => {
      setHistory({ shown: null, stack: [] });
    },
  };
}
