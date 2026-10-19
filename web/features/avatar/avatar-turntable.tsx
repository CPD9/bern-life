"use client";

// The bear on a plate, turned by dragging or with the arrow keys. It never spins by itself; it
// breathes and blinks while standing and waddles when Walk is on. Under the OS reduce-motion
// setting it stands still and Walk switches off; with lite graphics it stands still until Walk is on. The canvas renders
// only when something changes.

import { Canvas } from "@react-three/fiber";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { ContextLossWatch, SceneGuard } from "@/infrastructure/ui/scene-guard";
import { useReducedMotion } from "@/infrastructure/use-reduced-motion";
import { type BearConfig } from "./bear-config";
import { BearFigure } from "./bear-figure";
import { motionFor } from "./bear-motion";
import { NoTurntable, PLATE_AREA } from "./turntable";
import { RADIANS_PER_PIXEL, angleAfterKey, degreesOf, turnLabel } from "./turntable-turn";
import { WalkToggle, useWalking } from "./walk-toggle";

const PLATE_COLOUR = "#d9e2ea";

export function AvatarTurntable({ config, lite }: { config: BearConfig; lite: boolean }) {
  const [angle, setAngle] = useState(0);
  const reducedMotion = useReducedMotion();
  const [walking, toggleWalking] = useWalking(reducedMotion);
  const motion = motionFor(walking ? "walk" : "idle", { reducedMotion, lite });
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
          aria-label="Turn your avatar"
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
            camera={{ position: [0, 0.9, 3.4], fov: 28 }}
            onCreated={({ camera }) => camera.lookAt(0, 0.62, 0)}
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
            <group rotation-y={angle}>
              <BearFigure config={config} lite={lite} motion={motion} />
            </group>
          </Canvas>
        </div>
        <figcaption className="text-muted text-sm">Drag to spin, or use the arrow keys</figcaption>
        <WalkToggle walking={walking} reducedMotion={reducedMotion} onToggle={toggleWalking} />
      </SceneGuard>
    </figure>
  );
}
