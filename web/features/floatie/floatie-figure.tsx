// Bärli's light around whatever figure it wears: the bear the player made for their agent, passed
// in from app/ because the bear is another feature. The figure is scaled to fit, feet on y = 0 and
// about 1.4 m tall like the avatar's bear, and centred on Bärli. The halo is one sprite with a
// smooth radial falloff, not stacked see-through spheres, so it shows no rings on a dark page; it
// sits behind the figure and needs no bloom pass, the same in lite graphics.

import { type ReactNode, useEffect, useMemo } from "react";
import { CanvasTexture, SRGBColorSpace, type Texture } from "three";
import { type FloatieState } from "./floatie-motion";
import { PART, useFloatieMotion } from "./use-floatie-motion";

const HALO = "#ffd36b";
const EMBER = "#ffae3c";

/** The worn figure's height in its own units, and how tall it is drawn inside Bärli's light. */
const FIGURE_HEIGHT = 1.4;
const SHOWN_HEIGHT = 0.48;
const FIGURE_SCALE = SHOWN_HEIGHT / FIGURE_HEIGHT;

const HALO_SIZE = 0.72;
const RIPPLE_RADIUS = 0.27;

/** Alpha from the centre of the halo to its edge, as [offset, opacity] gradient stops. */
const HALO_FALLOFF: readonly (readonly [number, number])[] = [
  [0, 0.55],
  [0.35, 0.3],
  [0.7, 0.08],
  [1, 0],
];

function haloTexture(): Texture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context !== null) {
    const middle = size / 2;
    const gradient = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
    for (const [offset, opacity] of HALO_FALLOFF) {
      gradient.addColorStop(offset, `rgba(255, 255, 255, ${opacity})`);
    }
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function Halo() {
  const texture = useMemo(() => haloTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group name={PART.halo} position={[0, 0, -0.3]}>
      <sprite scale={HALO_SIZE}>
        <spriteMaterial
          map={texture}
          color={HALO}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    </group>
  );
}

export function FloatieFigure({
  state,
  reducedMotion,
  lite,
  children,
}: {
  state: FloatieState;
  reducedMotion: boolean;
  lite: boolean;
  /** The figure Bärli wears, feet on y = 0 and facing +z. */
  children: ReactNode;
}) {
  const root = useFloatieMotion(state, reducedMotion);
  const segments = lite ? 28 : 64;
  return (
    <group ref={root}>
      <Halo />
      <group name={PART.body}>
        <group position={[0, -SHOWN_HEIGHT / 2, 0]} scale={FIGURE_SCALE}>
          {children}
        </group>
      </group>
      <mesh name={PART.ripple} visible={false}>
        <ringGeometry args={[RIPPLE_RADIUS, RIPPLE_RADIUS * 1.06, segments]} />
        <meshBasicMaterial
          color={HALO}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight name={PART.light} color={EMBER} distance={1.2} position={[0, 0, 0.3]} />
    </group>
  );
}
