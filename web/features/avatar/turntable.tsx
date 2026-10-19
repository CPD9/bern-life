"use client";

// A figure on a plate, turned by dragging or with the arrow keys. It does not spin by itself: the
// canvas renders only when the angle changes, and nothing moves that the player did not move.

import { Canvas } from "@react-three/fiber";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { Button } from "@/infrastructure/ui/button";
import { ContextLossWatch, SceneGuard, useTakeLostFocus } from "@/infrastructure/ui/scene-guard";
import { RADIANS_PER_PIXEL, angleAfterKey, degreesOf, turnLabel } from "./turntable-turn";

const PLATE_COLOUR = "#d9e2ea";
export const PLATE_AREA = "bg-chip h-72 w-full max-w-sm rounded-[1.5rem] sm:h-96";

/**
 * The plate's place when it cannot be drawn; every choice beside it still counts. `onRetry` is
 * given when trying again may help; a preview that stops drawing takes the focus it held with it,
 * so this takes that focus instead.
 */
export function NoTurntable({ onRetry }: { onRetry: (() => void) | null }) {
  const plate = useRef<HTMLDivElement>(null);
  useTakeLostFocus(plate, onRetry !== null);
  return (
    <div
      ref={plate}
      tabIndex={-1}
      className={`${PLATE_AREA} text-muted flex flex-col items-center justify-center gap-3 p-6 text-center`}
    >
      <p>
        {onRetry === null
          ? "The preview needs 3D graphics, which this browser does not offer."
          : "The preview stopped drawing."}{" "}
        Every choice still counts.
      </p>
      {onRetry !== null && (
        <Button variant="ghost" onClick={onRetry}>
          Try the preview again
        </Button>
      )}
    </div>
  );
}

type TurntableProps = {
  label: string;
  lite: boolean;
  /** Height the camera looks at, roughly the middle of the figure. */
  focusY: number;
  children: ReactNode;
};

export function Turntable({ label, lite, focusY, children }: TurntableProps) {
  const [angle, setAngle] = useState(0);
  const dragX = useRef<number | null>(null);
  const plate = useRef<HTMLDivElement>(null);
  const degrees = degreesOf(angle);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = angleAfterKey(angle, event.key);
    if (next === null) return;
    event.preventDefault();
    setAngle(next);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragX.current = event.clientX;
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragX.current === null) return;
    const dx = event.clientX - dragX.current;
    dragX.current = event.clientX;
    setAngle((a) => a + dx * RADIANS_PER_PIXEL);
  };

  const endDrag = () => {
    dragX.current = null;
  };

  return (
    <figure className="flex min-w-0 flex-col items-center gap-2">
      <SceneGuard
        fallback={(retry) => <NoTurntable onRetry={retry} />}
        pending={<div className={PLATE_AREA} />}
        focusAfterRetry={plate}
      >
        <div
          ref={plate}
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={359}
          aria-valuenow={degrees}
          aria-valuetext={turnLabel(degrees)}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={`${PLATE_AREA} cursor-grab touch-none active:cursor-grabbing`}
        >
          <Canvas
            key={lite ? "lite" : "full"}
            frameloop="demand"
            shadows={!lite}
            dpr={lite ? 1 : [1, 2]}
            gl={{ alpha: true }}
            camera={{ position: [0, focusY + 0.2, 3.5], fov: 28 }}
            onCreated={({ camera }) => camera.lookAt(0, focusY, 0)}
          >
            <ContextLossWatch />
            <hemisphereLight color="#fff8ee" groundColor="#b9c4cf" intensity={1.6} />
            <directionalLight position={[2, 4, 3]} intensity={1.8} castShadow={!lite} />
            {/* A soft fill from the viewer's side, so a face is never left in shadow. */}
            <directionalLight position={[0, 1.4, 4]} intensity={0.7} />
            <mesh rotation-x={-Math.PI / 2} receiveShadow={!lite}>
              <circleGeometry args={[0.7, 32]} />
              <meshLambertMaterial color={PLATE_COLOUR} />
            </mesh>
            <group rotation-y={angle}>{children}</group>
          </Canvas>
        </div>
        <figcaption className="text-muted text-sm">Drag to spin, or use the arrow keys</figcaption>
      </SceneGuard>
    </figure>
  );
}
