// Lumi from primitives: a honey-gold seed of light with a sleepy face, a sprout on top and two
// see-through wings. The glow is layered, see-through spheres plus a small warm light, so it needs no
// bloom pass and works the same in lite graphics, only with fewer segments.

import { DoubleSide } from "three";
import { type FloatieState } from "./floatie-motion";
import { PART, useFloatieMotion } from "./use-floatie-motion";

const CORE = "#ffd27a";
const EMBER = "#ffae3c";
const HALO = "#ffd36b";
const WING = "#fff0c8";
const FACE = "#4a3220";
const CHEEK = "#ff9f8a";
const SPROUT = "#7fb65a";

const CORE_RADIUS = 0.16;

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

/** A fairy's pair on each side: a large upper wing and a small lower one, hinged at the body. */
function Wing({ side, segments }: { side: -1 | 1; segments: number }) {
  const blades: readonly [number, number, number, number][] = [
    // x, y, length, tilt
    [0.13, 0.04, 0.13, 0.5],
    [0.1, -0.05, 0.08, -0.35],
  ];
  return (
    <group name={PART.wings[side < 0 ? 0 : 1]} position={[side * 0.1, 0, -0.06]}>
      {blades.map(([x, y, length, tilt]) => (
        <mesh
          key={y}
          position={[side * x, y, 0]}
          rotation={[0, 0, side * tilt]}
          scale={[1, 0.45, 0.08]}
        >
          <sphereGeometry args={[length, segments, segments]} />
          <meshBasicMaterial
            color={WING}
            transparent
            opacity={0.7}
            side={DoubleSide}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Face({ segments }: { segments: number }) {
  const z = CORE_RADIUS * 0.94;
  return (
    <group>
      {PART.eyes.map((name, index) => (
        <mesh key={name} name={name} position={[(index === 0 ? -1 : 1) * 0.052, 0.02, z]}>
          <sphereGeometry args={[0.02, segments, segments]} />
          <meshBasicMaterial color={FACE} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.092, -0.024, z * 0.82]} scale={[1, 0.6, 0.4]}>
          <sphereGeometry args={[0.024, segments, segments]} />
          <meshBasicMaterial color={CHEEK} transparent opacity={0.7} />
        </mesh>
      ))}
      <mesh position={[0, -0.018, z + 0.004]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.022, 0.006, 8, segments, Math.PI]} />
        <meshBasicMaterial color={FACE} />
      </mesh>
    </group>
  );
}

function Sprout({ segments }: { segments: number }) {
  return (
    <group position={[0, CORE_RADIUS * 0.95, 0]}>
      <mesh position={[0, 0.025, 0]} rotation={[0, 0, -0.2]}>
        <cylinderGeometry args={[0.006, 0.008, 0.05, 8]} />
        <meshLambertMaterial color={SPROUT} />
      </mesh>
      <mesh position={[0.03, 0.055, 0]} rotation={[0, 0, -0.5]} scale={[1, 0.4, 0.6]}>
        <sphereGeometry args={[0.035, segments, segments]} />
        <meshLambertMaterial color={SPROUT} emissive={SPROUT} emissiveIntensity={0.25} />
      </mesh>
    </group>
  );
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
  return (
    <group ref={root}>
      <group name={PART.body}>
        <mesh name={PART.core}>
          <sphereGeometry args={[CORE_RADIUS, segments, segments]} />
          {lite ? (
            <meshLambertMaterial color={CORE} emissive={EMBER} toneMapped={false} />
          ) : (
            <meshStandardMaterial
              color={CORE}
              emissive={EMBER}
              roughness={0.55}
              toneMapped={false}
            />
          )}
        </mesh>
        <Face segments={segments} />
        <Sprout segments={segments} />
        <Wing side={-1} segments={segments} />
        <Wing side={1} segments={segments} />
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
