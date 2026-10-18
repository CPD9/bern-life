// The big round head and what makes each kind recognisable: ear shape, panda patches, red panda
// marks and ibex horns. Head coordinates, centred on the head.

import { HeadAccessory } from "./bear-accessory";
import { type BearConfig, type KindId } from "./bear-config";
import { BearFace } from "./bear-face";
import { type BearLook } from "./bear-look";
import { HEAD, headSurfaceZ } from "./bear-shape";
import { Ball, Plush, useSegments } from "./plush";
import { PART } from "./use-bear-motion";

type EarShape = "round" | "pointed" | "small" | "long";

const EARS: Readonly<Record<KindId, EarShape>> = {
  "brown-bear": "round",
  "polar-bear": "round",
  panda: "round",
  "red-panda": "pointed",
  marmot: "small",
  ibex: "long",
};

function Ear({ side, shape, look }: { side: 1 | -1; shape: EarShape; look: BearLook }) {
  switch (shape) {
    case "round":
      return (
        <group position={[side * 0.26, 0.25, -0.02]}>
          <Ball colour={look.ears} radius={0.12} />
          <Ball colour={look.innerEars} radius={0.07} position={[0, 0, 0.08]} scale={[1, 1, 0.4]} />
        </group>
      );
    case "pointed":
      return (
        <group position={[side * 0.25, 0.27, 0]} rotation={[0, 0, -side * 0.35]}>
          <Ball colour={look.ears} radius={0.12} scale={[0.95, 1.35, 0.6]} />
          <Ball
            colour={look.innerEars}
            radius={0.075}
            position={[0, -0.01, 0.06]}
            scale={[0.9, 1.3, 0.4]}
          />
        </group>
      );
    case "small":
      return <Ball colour={look.ears} radius={0.065} position={[side * 0.3, 0.17, -0.03]} />;
    case "long":
      return (
        <group position={[side * 0.34, 0.06, 0]} rotation={[0, 0, side * 0.35]}>
          <Ball colour={look.ears} radius={0.08} scale={[1.6, 0.7, 0.5]} />
          <Ball
            colour={look.innerEars}
            radius={0.05}
            position={[0, 0, 0.03]}
            scale={[1.5, 0.6, 0.3]}
          />
        </group>
      );
  }
}

/** Ibex horns: thick, rounded arcs rising from the crown and sweeping back. */
function Horns({ colour }: { colour: string }) {
  const segments = useSegments();
  return [-1, 1].map((side) => (
    // Turned so the arc starts at the front of the crown, rises over the top and ends behind.
    <mesh
      key={side}
      castShadow
      position={[side * 0.13, 0.18, -0.1]}
      rotation={[0, -Math.PI / 2, side * 0.18]}
    >
      <torusGeometry args={[0.22, 0.06, Math.round(segments / 3), segments, 2.5]} />
      <Plush colour={colour} />
    </mesh>
  ));
}

export function BearHead({ config, look }: { config: BearConfig; look: BearLook }) {
  const shape = EARS[config.kind];
  return (
    <group name={PART.head} position-y={HEAD.y}>
      <Ball colour={look.fur} radius={HEAD.radius} />
      {[-1, 1].map((side) => (
        <Ear key={side} side={side as 1 | -1} shape={shape} look={look} />
      ))}
      {look.horns && <Horns colour={look.horns} />}
      {look.eyePatches &&
        [-1, 1].map((side) => (
          <Ball
            key={side}
            colour={look.eyePatches as string}
            radius={0.085}
            position={[side * 0.13, 0.035, headSurfaceZ(side * 0.13, 0.035) - 0.03]}
            rotation={[0, 0, side * 0.5]}
            scale={[0.85, 1.15, 0.35]}
          />
        ))}
      {look.faceMarks &&
        [-1, 1].map((side) => (
          <group key={side}>
            <Ball
              colour={look.faceMarks as string}
              radius={0.045}
              position={[side * 0.13, 0.15, headSurfaceZ(side * 0.13, 0.15) - 0.01]}
              scale={[1.3, 0.7, 0.4]}
            />
            <Ball
              colour={look.faceMarks as string}
              radius={0.08}
              position={[side * 0.2, -0.08, headSurfaceZ(side * 0.2, -0.08) - 0.03]}
              scale={[1, 0.8, 0.4]}
            />
          </group>
        ))}
      <Ball
        colour={look.muzzle}
        radius={0.15}
        position={[0, -0.1, 0.3]}
        scale={[1.25, 0.85, 0.75]}
      />
      <Ball
        colour={look.nose}
        radius={0.05}
        position={[0, -0.045, 0.405]}
        scale={[1.35, 0.95, 0.8]}
      />
      <BearFace face={config.face} eyes={look.eyes} mouth={look.nose} />
      <HeadAccessory accessory={config.accessory} />
    </group>
  );
}
