// The small round body with a light belly, stubby arms and legs, round feet and a tail that suits
// the kind: a bob for bears, a long ringed tail for the red panda, a bushy one for the marmot.

import { type KindId } from "./bear-config";
import { type BearLook } from "./bear-look";
import { BODY } from "./bear-shape";
import { Ball, Plush, useSegments } from "./plush";

const ARM_SPREAD = 0.55;

function Arm({ side, colour }: { side: 1 | -1; colour: string }) {
  const segments = useSegments();
  return (
    <group position={[side * 0.24, 0.53, 0]} rotation={[0, 0, side * ARM_SPREAD]}>
      <mesh castShadow position-y={-0.12}>
        <capsuleGeometry args={[0.085, 0.14, 6, segments]} />
        <Plush colour={colour} />
      </mesh>
    </group>
  );
}

function Leg({ side, look }: { side: 1 | -1; look: BearLook }) {
  const segments = useSegments();
  return (
    <group position-x={side * 0.13}>
      <mesh castShadow position-y={0.14}>
        <capsuleGeometry args={[0.1, 0.04, 6, segments]} />
        <Plush colour={look.limbs} />
      </mesh>
      <Ball colour={look.limbs} radius={0.11} position={[0, 0.06, 0.04]} scale={[1, 0.55, 1.25]} />
    </group>
  );
}

function Tail({ kind, look }: { kind: KindId; look: BearLook }) {
  if (kind === "red-panda") {
    return Array.from({ length: 5 }, (_, index) => (
      <Ball
        key={index}
        colour={index % 2 === 0 ? look.fur : look.limbs}
        radius={0.1 - index * 0.006}
        position={[0, 0.16 + index * 0.075, -0.3 - index * 0.055]}
      />
    ));
  }
  if (kind === "marmot") return <Ball colour={look.limbs} radius={0.1} position={[0, 0.2, -0.3]} />;
  return <Ball colour={look.fur} radius={0.07} position={[0, 0.22, -0.27]} />;
}

export function BearBody({
  kind,
  look,
  sleeves,
}: {
  kind: KindId;
  look: BearLook;
  sleeves: string | null;
}) {
  return (
    <group>
      <Ball
        colour={look.fur}
        radius={BODY.radius}
        position={[0, BODY.y, 0]}
        scale={[...BODY.scale]}
      />
      <Ball colour={look.belly} radius={0.17} position={[0, 0.27, 0.17]} scale={[1, 0.85, 0.55]} />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Arm side={side as 1 | -1} colour={sleeves ?? look.limbs} />
          <Leg side={side as 1 | -1} look={look} />
        </group>
      ))}
      <Tail kind={kind} look={look} />
    </group>
  );
}
