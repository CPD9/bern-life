"use client";

// A 3D scene that cannot take the app down with it. Before a canvas mounts, the browser is asked
// whether it offers WebGL; a scene that throws, or whose context is lost and not given back, gives
// way to its fallback. Everything around the scene keeps working, and focus that went with the
// scene, or with the fallback's "Try again", lands on what took its place.

import { Canvas, type CanvasProps, useThree } from "@react-three/fiber";
import {
  Component,
  type ReactNode,
  type RefObject,
  createContext,
  useContext,
  useEffect,
} from "react";
import { useWebgl } from "@/infrastructure/webgl";

/**
 * What stands in for a scene. `retry` is passed when trying again may help, after a throw or a lost
 * context; it is null when the browser offers no WebGL at all.
 */
export type SceneFallback = (retry: (() => void) | null) => ReactNode;

const LoseScene = createContext<(() => void) | null>(null);

/** From inside a guarded scene: gives the scene up for its fallback. Null outside a guard. */
export function useLoseScene(): (() => void) | null {
  return useContext(LoseScene);
}

/** True when focus has fallen back to the page, as when the element that held it was removed. */
function focusLost(): boolean {
  const active = document.activeElement;
  return active === null || active === document.body;
}

/**
 * Focuses `ref` once mounted when `when` holds and focus was lost, so a keyboard user whose scene
 * gave way lands on its fallback instead of the top of the page. Focus anywhere else stays put.
 */
export function useTakeLostFocus(ref: RefObject<HTMLElement | null>, when: boolean): void {
  useEffect(() => {
    if (when && focusLost()) ref.current?.focus();
  }, [ref, when]);
}

type BoundaryProps = {
  fallback: SceneFallback;
  focusAfterRetry: RefObject<HTMLElement | null> | undefined;
  children: ReactNode;
};
type BoundaryState = { failed: boolean };

class SceneBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  private readonly lose = () => this.setState({ failed: true });
  private readonly retry = () => this.setState({ failed: false });

  // "Try again" goes with the fallback, so the scene that comes back takes the focus it held.
  override componentDidUpdate(_props: BoundaryProps, previous: BoundaryState) {
    if (previous.failed && !this.state.failed && focusLost()) {
      this.props.focusAfterRetry?.current?.focus();
    }
  }

  override render() {
    if (this.state.failed) return this.props.fallback(this.retry);
    return <LoseScene.Provider value={this.lose}>{this.props.children}</LoseScene.Provider>;
  }
}

type SceneGuardProps = {
  fallback: SceneFallback;
  /** Shown on the server and while hydrating, before it is known whether WebGL exists. */
  pending?: ReactNode;
  /** What takes focus when the scene comes back after "Try again": focusable, inside the scene. */
  focusAfterRetry?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

export function SceneGuard({
  fallback,
  pending = null,
  focusAfterRetry,
  children,
}: SceneGuardProps) {
  const webgl = useWebgl();
  if (webgl === null) return pending;
  if (!webgl) return fallback(null);
  return (
    <SceneBoundary fallback={fallback} focusAfterRetry={focusAfterRetry}>
      {children}
    </SceneBoundary>
  );
}

/** How long a lost WebGL context may take to come back, while the page is shown, before giving up. */
export const RESTORE_WAIT_MS = 3000;

type LossHandlers = { onGiveUp: () => void; onRestored: () => void; waitMs?: number };

/**
 * Listens for a canvas losing its context. three.js asks the browser to give it back; when it comes
 * back the scene draws again, and when it has not after `waitMs` with the page shown (a hidden tab
 * may get it back only once shown again), `onGiveUp` runs. A canvas already out of the page is
 * being released on purpose, as when lite graphics remount the renderer, so its loss is ignored.
 */
export function watchContextLoss(
  canvas: HTMLCanvasElement,
  { onGiveUp, onRestored, waitMs = RESTORE_WAIT_MS }: LossHandlers,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wait = () => {
    timer = setTimeout(() => {
      if (document.visibilityState === "hidden") wait();
      else onGiveUp();
    }, waitMs);
  };
  const lost = () => {
    if (!canvas.isConnected) return;
    clearTimeout(timer);
    wait();
  };
  const restored = () => {
    clearTimeout(timer);
    onRestored();
  };
  canvas.addEventListener("webglcontextlost", lost);
  canvas.addEventListener("webglcontextrestored", restored);
  return () => {
    clearTimeout(timer);
    canvas.removeEventListener("webglcontextlost", lost);
    canvas.removeEventListener("webglcontextrestored", restored);
  };
}

/**
 * Inside a guarded canvas. Its listeners go before the renderer is released (a canvas's children
 * unmount first), so letting go of a context on purpose is never taken for a loss.
 */
export function ContextLossWatch({ waitMs = RESTORE_WAIT_MS }: { waitMs?: number }) {
  const lose = useLoseScene();
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (lose === null) return;
    return watchContextLoss(canvas, { onGiveUp: lose, onRestored: () => invalidate(), waitMs });
  }, [canvas, invalidate, lose, waitMs]);
  return null;
}

type SceneCanvasProps = Omit<CanvasProps, "fallback"> & { fallback: SceneFallback };

/** React Three Fiber's canvas, guarded: what the browser cannot draw shows `fallback` instead. */
export function SceneCanvas({ fallback, children, ...canvas }: SceneCanvasProps) {
  return (
    <SceneGuard fallback={fallback}>
      <Canvas {...canvas}>
        <ContextLossWatch />
        {children}
      </Canvas>
    </SceneGuard>
  );
}
