// The building blocks the office is made of: a box, a round column and a ball in flat, warm
// colours. Lite graphics drops shadows and segments; the choice travels through context instead
// of being passed to every piece of furniture.

import { createContext, useContext } from "react";

type Quality = { readonly shadows: boolean; readonly segments: number };

const QualityContext = createContext<Quality>({ shadows: true, segments: 24 });

export const OfficeQualityProvider = QualityContext.Provider;

export function officeQuality(lite: boolean): Quality {
  return { shadows: !lite, segments: lite ? 10 : 24 };
}

/** The warm tint a hotspot takes while the pointer is over it. */
const GLOW = "#4a3418";
const NO_GLOW = "#000000";

type Vec3 = readonly [number, number, number];
type Look = { colour: string; position: Vec3; glow?: boolean };

function Paint({ colour, glow }: { colour: string; glow: boolean }) {
  return <meshLambertMaterial color={colour} emissive={glow ? GLOW : NO_GLOW} />;
}

export function Block({ size, colour, position, glow = false }: Look & { size: Vec3 }) {
  const { shadows } = useContext(QualityContext);
  return (
    <mesh position={position} castShadow={shadows} receiveShadow={shadows}>
      <boxGeometry args={size} />
      <Paint colour={colour} glow={glow} />
    </mesh>
  );
}

/** A column standing on its base: `position` is the centre of its bottom face. */
export function Column({
  radius,
  top = radius,
  height,
  colour,
  position,
  glow = false,
}: Look & { radius: number; top?: number; height: number }) {
  const { shadows, segments } = useContext(QualityContext);
  const [x, y, z] = position;
  return (
    <mesh position={[x, y + height / 2, z]} castShadow={shadows} receiveShadow={shadows}>
      <cylinderGeometry args={[top, radius, height, segments]} />
      <Paint colour={colour} glow={glow} />
    </mesh>
  );
}

export function Ball({
  radius,
  colour,
  position,
  scale = [1, 1, 1],
}: Omit<Look, "glow"> & { radius: number; scale?: Vec3 }) {
  const { shadows, segments } = useContext(QualityContext);
  return (
    <mesh position={position} scale={scale} castShadow={shadows}>
      <sphereGeometry args={[radius, segments, Math.round(segments * 0.75)]} />
      <Paint colour={colour} glow={false} />
    </mesh>
  );
}
