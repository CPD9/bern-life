"use client";

// Lumi in its own small canvas inside a real button, so a tap, Enter or Space all reach `onSelect`
// and the focus ring is the page's own. A soft radial glow behind the canvas lets the light spill
// past the 3D figure onto whatever Lumi floats over.

import { Canvas } from "@react-three/fiber";
import { useState } from "react";
import { FloatieFigure } from "./floatie-figure";
import { type FloatieState, shownState } from "./floatie-motion";
import { FLOATIE_NAME } from "./lumi-lines";
import { useReducedMotion } from "./use-reduced-motion";

type FloatieProps = {
  onSelect: () => void;
  state?: FloatieState;
  lite?: boolean;
};

export function Floatie({ onSelect, state = "idle", lite = false }: FloatieProps) {
  const reducedMotion = useReducedMotion();
  const [pointedAt, setPointedAt] = useState(false);
  const [focused, setFocused] = useState(false);
  const shown = shownState(state, pointedAt, focused);

  return (
    <button
      type="button"
      aria-label={`${FLOATIE_NAME}, your Navigator`}
      onClick={onSelect}
      onPointerEnter={() => setPointedAt(true)}
      onPointerLeave={() => setPointedAt(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className="size-28 shrink-0 cursor-pointer rounded-full bg-[radial-gradient(circle,rgb(255_210_122/0.45)_0%,rgb(255_210_122/0)_65%)]"
    >
      <Canvas
        key={lite ? "lite" : "full"}
        frameloop="demand"
        dpr={lite ? 1 : [1, 2]}
        gl={{ alpha: true }}
        camera={{ position: [0, 0.05, 1.5], fov: 30 }}
        style={{ pointerEvents: "none" }}
      >
        <hemisphereLight color="#fff8ee" groundColor="#e8d8c0" intensity={1.4} />
        <directionalLight position={[1, 2, 3]} intensity={0.8} />
        <FloatieFigure state={shown} reducedMotion={reducedMotion} lite={lite} />
      </Canvas>
    </button>
  );
}
