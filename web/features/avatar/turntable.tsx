"use client";

// A figure on a plate, turned by dragging or with the arrow keys. It does not spin by itself: the
// canvas renders only when the angle changes, and nothing moves that the player did not move.

import { Canvas } from "@react-three/fiber";
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { RADIANS_PER_PIXEL, angleAfterKey, degreesOf, turnLabel } from "./turntable-turn";

const PLATE_COLOUR = "#d9e2ea";

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
      <div
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
        className="bg-chip h-72 w-full max-w-sm cursor-grab touch-none rounded-[1.5rem] active:cursor-grabbing sm:h-96"
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
    </figure>
  );
}
