"use client";

// The figure on a plate, turned by dragging or with the arrow keys. It does not spin by itself:
// the canvas renders only when the angle changes, and nothing moves that the player did not move.

import { Canvas } from "@react-three/fiber";
import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { type AvatarConfig } from "./avatar-config";
import { AvatarFigure } from "./avatar-figure";

const RADIANS_PER_PIXEL = 0.012;
const KEY_STEP_DEGREES = 15;
const PLATE_COLOUR = "#d9e2ea";

function degreesOf(radians: number): number {
  const degrees = Math.round((radians * 180) / Math.PI) % 360;
  return degrees < 0 ? degrees + 360 : degrees;
}

export function AvatarTurntable({ config, lite }: { config: AvatarConfig; lite: boolean }) {
  const [angle, setAngle] = useState(0);
  const dragX = useRef<number | null>(null);
  const degrees = degreesOf(angle);

  const turnBy = (deltaDegrees: number) => setAngle((a) => a + (deltaDegrees * Math.PI) / 180);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") turnBy(-KEY_STEP_DEGREES);
    else if (event.key === "ArrowRight") turnBy(KEY_STEP_DEGREES);
    else if (event.key === "Home") setAngle(0);
    else return;
    event.preventDefault();
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
        aria-label="Turn your avatar"
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={degrees}
        aria-valuetext={degrees === 0 ? "Facing you" : `Turned ${degrees} degrees`}
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
          camera={{ position: [0, 1.1, 4.4], fov: 28 }}
          onCreated={({ camera }) => camera.lookAt(0, 0.78, 0)}
        >
          <hemisphereLight color="#fff8ee" groundColor="#b9c4cf" intensity={1.6} />
          <directionalLight position={[2, 4, 3]} intensity={1.8} castShadow={!lite} />
          <mesh rotation-x={-Math.PI / 2} receiveShadow={!lite}>
            <circleGeometry args={[0.7, 32]} />
            <meshLambertMaterial color={PLATE_COLOUR} />
          </mesh>
          <group rotation-y={angle}>
            <AvatarFigure config={config} shadows={!lite} />
          </group>
        </Canvas>
      </div>
      <figcaption className="text-muted text-sm">Drag to spin, or use the arrow keys</figcaption>
    </figure>
  );
}
