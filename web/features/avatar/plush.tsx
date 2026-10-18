// The bear's soft, velvety look: a sheen material on smooth spheres. Lite graphics swaps it for a
// plain material with fewer segments, so older laptops and phones still keep up. The quality is
// shared through context instead of being passed to every part.

import { createContext, useContext } from "react";
import { DoubleSide, FrontSide } from "three";

type PlushQuality = { readonly lite: boolean; readonly segments: number };

const QualityContext = createContext<PlushQuality>({ lite: false, segments: 32 });

export const PlushQualityProvider = QualityContext.Provider;

export function plushQuality(lite: boolean): PlushQuality {
  return { lite, segments: lite ? 14 : 32 };
}

export function useSegments(): number {
  return useContext(QualityContext).segments;
}

const SHEEN = "#fff4e8";

export function Plush({
  colour,
  opacity = 1,
  twoSided = false,
}: {
  colour: string;
  opacity?: number;
  twoSided?: boolean;
}) {
  const { lite } = useContext(QualityContext);
  const side = twoSided ? DoubleSide : FrontSide;
  const transparent = opacity < 1;
  if (lite) {
    return (
      <meshLambertMaterial color={colour} side={side} transparent={transparent} opacity={opacity} />
    );
  }
  return (
    <meshPhysicalMaterial
      color={colour}
      roughness={0.85}
      sheen={1}
      sheenRoughness={0.55}
      sheenColor={SHEEN}
      side={side}
      transparent={transparent}
      opacity={opacity}
    />
  );
}

/** A sphere with the plush look, the building block of almost every part. */
export function Ball({
  colour,
  radius,
  opacity,
  ...placement
}: {
  colour: string;
  radius: number;
  opacity?: number;
  position?: [number, number, number];
  scale?: [number, number, number];
  rotation?: [number, number, number];
}) {
  const segments = useSegments();
  return (
    <mesh castShadow {...placement}>
      <sphereGeometry args={[radius, segments, Math.round(segments * 0.75)]} />
      <Plush colour={colour} {...(opacity === undefined ? {} : { opacity })} />
    </mesh>
  );
}
