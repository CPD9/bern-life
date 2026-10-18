// Lumi from primitives: a little bear cub made of honey-gold light, with round ears, a cream
// muzzle and little paws. All its fur shares one glowing material, so the whole
// bear brightens together. The glow is layered, see-through spheres plus a small warm light, so it
// needs no bloom pass and works the same in lite graphics, only with fewer segments.

import { useEffect, useMemo } from "react";
import { type Material, MeshLambertMaterial, MeshStandardMaterial } from "three";
import { type FloatieState } from "./floatie-motion";
import { PART, useFloatieMotion } from "./use-floatie-motion";

const FUR = "#ffcf7a";
const EMBER = "#ffae3c";
const HALO = "#ffd36b";
const FACE = "#4a3220";
const CHEEK = "#ff9f8a";
const MUZZLE = "#fff1d2";
const INNER_EAR = "#ffb36b";

const CORE_RADIUS = 0.16;
const HEAD_Y = 0.05;
const HEAD_RADIUS = 0.13;

function Glow({
  radius,
  opacity,
  segments,
}: {
  radius: number;
  opacity: number;
  segments: number;
}) {
  return (
    <mesh>
      <sphereGeometry args={[radius, segments, segments]} />
      <meshBasicMaterial
        color={HALO}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function Face({ segments }: { segments: number }) {
  const z = HEAD_RADIUS * 0.92;
  return (
    <group position={[0, HEAD_Y, 0]}>
      {PART.eyes.map((name, index) => (
        <mesh key={name} name={name} position={[(index === 0 ? -1 : 1) * 0.048, 0.025, z]}>
          <sphereGeometry args={[0.017, segments, segments]} />
          <meshBasicMaterial color={FACE} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.082, -0.022, z * 0.84]} scale={[1, 0.6, 0.4]}>
          <sphereGeometry args={[0.022, segments, segments]} />
          <meshBasicMaterial color={CHEEK} transparent opacity={0.7} />
        </mesh>
      ))}
      <mesh position={[0, -0.025, z - 0.01]} scale={[1, 0.75, 0.6]}>
        <sphereGeometry args={[0.048, segments, segments]} />
        <meshBasicMaterial color={MUZZLE} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.012, z + 0.018]} scale={[1.3, 0.85, 0.8]}>
        <sphereGeometry args={[0.013, segments, segments]} />
        <meshBasicMaterial color={FACE} />
      </mesh>
      <mesh position={[0, -0.03, z + 0.016]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.012, 0.004, 8, segments, Math.PI]} />
        <meshBasicMaterial color={FACE} />
      </mesh>
    </group>
  );
}

/** The glowing fur every part of the bear shares, so its glow can be turned up in one place. */
function useFur(lite: boolean): Material {
  const fur = useMemo(
    () =>
      lite
        ? new MeshLambertMaterial({ color: FUR, emissive: EMBER, toneMapped: false })
        : new MeshStandardMaterial({
            color: FUR,
            emissive: EMBER,
            roughness: 0.55,
            toneMapped: false,
          }),
    [lite],
  );
  useEffect(() => () => fur.dispose(), [fur]);
  return fur;
}

function Ears({ fur, segments }: { fur: Material; segments: number }) {
  return [-1, 1].map((side) => (
    <group key={side} position={[side * 0.09, HEAD_Y + 0.1, -0.01]}>
      <mesh material={fur}>
        <sphereGeometry args={[0.045, segments, segments]} />
      </mesh>
      <mesh position={[0, 0, 0.03]} scale={[1, 1, 0.4]}>
        <sphereGeometry args={[0.026, segments, segments]} />
        <meshBasicMaterial color={INNER_EAR} toneMapped={false} />
      </mesh>
    </group>
  ));
}

export function FloatieFigure({
  state,
  reducedMotion,
  lite,
}: {
  state: FloatieState;
  reducedMotion: boolean;
  lite: boolean;
}) {
  const root = useFloatieMotion(state, reducedMotion);
  const segments = lite ? 14 : 32;
  const fur = useFur(lite);
  return (
    <group ref={root}>
      <group name={PART.body}>
        <mesh name={PART.core} material={fur} position={[0, HEAD_Y, 0]}>
          <sphereGeometry args={[HEAD_RADIUS, segments, segments]} />
        </mesh>
        <mesh material={fur} position={[0, -0.1, -0.01]} scale={[1, 0.95, 0.9]}>
          <sphereGeometry args={[0.095, segments, segments]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} material={fur} position={[side * 0.07, -0.085, 0.07]}>
            <sphereGeometry args={[0.032, segments, segments]} />
          </mesh>
        ))}
        <Ears fur={fur} segments={segments} />
        <Face segments={segments} />
      </group>
      <group name={PART.halo}>
        <Glow radius={CORE_RADIUS * 1.25} opacity={0.2} segments={segments} />
        <Glow radius={CORE_RADIUS * 1.55} opacity={0.1} segments={segments} />
        <Glow radius={CORE_RADIUS * 1.9} opacity={0.05} segments={segments} />
      </group>
      <mesh name={PART.ripple} visible={false}>
        <ringGeometry args={[CORE_RADIUS * 1.3, CORE_RADIUS * 1.38, segments * 2]} />
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
