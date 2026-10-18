// One accessory per bear. Glasses and the hard hat are drawn in head coordinates and ride on the
// head, so they tilt with it; the scarf and the backpack are drawn on the body.

import { type AccessoryId } from "./bear-config";
import { NECK_Y, headSurfaceZ } from "./bear-shape";
import { Ball, Plush, useSegments } from "./plush";

const SCARF = "#d9534f";
const FRAMES = "#2b2a2e";
const HARD_HAT = "#f2b632";
const BACKPACK = "#3f6fb0";

function Scarf() {
  const segments = useSegments();
  return (
    <group>
      <mesh castShadow position-y={NECK_Y} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.19, 0.055, 10, segments]} />
        <Plush colour={SCARF} />
      </mesh>
      <mesh castShadow position={[0.11, NECK_Y - 0.12, 0.2]} rotation-z={0.2}>
        <boxGeometry args={[0.09, 0.2, 0.04]} />
        <Plush colour={SCARF} />
      </mesh>
    </group>
  );
}

function Glasses() {
  const y = 0.05;
  const z = headSurfaceZ(0.13, y) + 0.03;
  return (
    <group position={[0, y, z]}>
      {[-1, 1].map((side) => (
        <mesh key={side} position-x={side * 0.13}>
          <torusGeometry args={[0.068, 0.012, 8, 24]} />
          <meshLambertMaterial color={FRAMES} />
        </mesh>
      ))}
      <mesh>
        <boxGeometry args={[0.12, 0.015, 0.015]} />
        <meshLambertMaterial color={FRAMES} />
      </mesh>
    </group>
  );
}

function HardHat() {
  const segments = useSegments();
  return (
    <group position-y={0.12}>
      <mesh castShadow>
        <sphereGeometry args={[0.31, segments, segments / 2, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <Plush colour={HARD_HAT} />
      </mesh>
      <mesh castShadow position={[0, 0, 0.04]}>
        <cylinderGeometry args={[0.37, 0.37, 0.03, segments]} />
        <Plush colour={HARD_HAT} />
      </mesh>
    </group>
  );
}

function Backpack() {
  return (
    <group>
      <Ball colour={BACKPACK} radius={0.19} position={[0, 0.42, -0.27]} scale={[1, 1.1, 0.6]} />
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.13, 0.48, 0.2]} rotation-x={-0.2}>
          <boxGeometry args={[0.05, 0.26, 0.03]} />
          <meshLambertMaterial color={BACKPACK} />
        </mesh>
      ))}
    </group>
  );
}

/** The part of the accessory that sits on the head, in head coordinates. */
export function HeadAccessory({ accessory }: { accessory: AccessoryId }) {
  if (accessory === "glasses") return <Glasses />;
  if (accessory === "hard-hat") return <HardHat />;
  return null;
}

/** The part of the accessory that sits on the body. */
export function BodyAccessory({ accessory }: { accessory: AccessoryId }) {
  if (accessory === "scarf") return <Scarf />;
  if (accessory === "backpack") return <Backpack />;
  return null;
}
