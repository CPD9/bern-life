"use client";

import { Canvas } from "@react-three/fiber";

// Transparent so the shell's sky shows through; "demand" renders only when something changes.
export function WorldCanvas() {
  return <Canvas frameloop="demand" gl={{ alpha: true }} />;
}
