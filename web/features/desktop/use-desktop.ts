"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  type Bounds,
  type WindowStack,
  closeWindow,
  cycleWindows,
  focusWindow,
  moveWindow,
  openWindow,
  topWindow,
} from "./window-manager";

/** A window takes keyboard focus when it opens or is cycled to, never on a click inside it. */
export type FocusRequest = { readonly appId: string; readonly nonce: number };

export type DesktopController = {
  readonly windows: WindowStack;
  readonly focusRequest: FocusRequest | null;
  open(appId: string): void;
  close(appId: string): void;
  focus(appId: string): void;
  cycle(step: 1 | -1): void;
  move(appId: string, dx: number, dy: number): void;
  setBounds(bounds: Bounds): void;
};

type DesktopState = { windows: WindowStack; focusRequest: FocusRequest | null };

// Until the desktop is measured, place windows as on a small laptop screen.
const unmeasured: Bounds = { width: 1024, height: 640 };

function requestFor(windows: WindowStack, previous: FocusRequest | null): FocusRequest | null {
  const top = topWindow(windows);
  return top ? { appId: top.appId, nonce: (previous?.nonce ?? 0) + 1 } : null;
}

export function useDesktop(): DesktopController {
  const [state, setState] = useState<DesktopState>({ windows: [], focusRequest: null });
  const bounds = useRef<Bounds>(unmeasured);

  const open = useCallback((appId: string) => {
    setState(({ windows, focusRequest }) => {
      const next = openWindow(windows, appId, bounds.current);
      return { windows: next, focusRequest: requestFor(next, focusRequest) };
    });
  }, []);
  const close = useCallback((appId: string) => {
    setState(({ windows, focusRequest }) => ({
      windows: closeWindow(windows, appId),
      focusRequest,
    }));
  }, []);
  const focus = useCallback((appId: string) => {
    setState(({ windows, focusRequest }) => ({
      windows: focusWindow(windows, appId),
      focusRequest,
    }));
  }, []);
  const cycle = useCallback((step: 1 | -1) => {
    setState(({ windows, focusRequest }) => {
      const next = cycleWindows(windows, step);
      return { windows: next, focusRequest: requestFor(next, focusRequest) };
    });
  }, []);
  const move = useCallback((appId: string, dx: number, dy: number) => {
    setState(({ windows, focusRequest }) => ({
      windows: moveWindow(windows, appId, dx, dy, bounds.current),
      focusRequest,
    }));
  }, []);
  const setBounds = useCallback((next: Bounds) => {
    bounds.current = next;
  }, []);

  return useMemo(
    () => ({ ...state, open, close, focus, cycle, move, setBounds }),
    [state, open, close, focus, cycle, move, setBounds],
  );
}
