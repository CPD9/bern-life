// The small round body with a light belly, stubby arms and legs, round feet and a tail that suits
// the kind: a bob for bears, a long ringed tail for the red panda, a bushy one for the marmot.

import { type KindId } from "./bear-config";
import { type BearLook } from "./bear-look";
import { BODY } from "./bear-shape";
import { Ball, Plush, useSegments } from "./plush";
import { PART } from "./use-bear-motion";

const ARM_SPREAD = 0.55;
/** Legs swing from the hip, so a foot lifts forward or back rather than sliding. */
const HIP_Y = 0.22;

/** Side -1 is the bear's right (it faces +z), index 0 in the pose's [right, left] pairs. */
type Limb = { side: 1 | -1; index: 0 | 1 };

function Arm({ side, index, colour }: Limb & { colour: string }) {
  const segments = useSegments();
  return (
    <group position={[side * 0.24, 0.53, 0]} rotation={[0, 0, side * ARM_SPREAD]}>
      <group name={PART.arms[index]}>
        <mesh castShadow position-y={-0.12}>
          <capsuleGeometry args={[0.085, 0.14, 6, segments]} />
          <Plush colour={colour} />
        </mesh>
      </group>
    </group>
  );
}

function Leg({ side, index, look }: Limb & { look: BearLook }) {
  const segments = useSegments();
  return (
    <group name={PART.legs[index]} position={[side * 0.13, HIP_Y, 0]}>
      <mesh castShadow position-y={0.14 - HIP_Y}>
        <capsuleGeometry args={[0.1, 0.04, 6, segments]} />
        <Plush colour={look.limbs} />
      </mesh>
      <Ball
        colour={look.limbs}
        radius={0.11}
        position={[0, 0.06 - HIP_Y, 0.04]}
        scale={[1, 0.55, 1.25]}
      />
    </group>
  );
}

function TailShape({ kind, look }: { kind: KindId; look: BearLook }) {
  if (kind === "red-panda") {
    return Array.from({ length: 5 }, (_, index) => (
      <Ball
        key={index}
        colour={index % 2 === 0 ? look.fur : look.limbs}
        radius={0.1 - index * 0.006}
        position={[0, index * 0.075 - 0.04, -0.03 - index * 0.055]}
      />
    ));
  }
  if (kind === "marmot") return <Ball colour={look.limbs} radius={0.1} position={[0, 0, -0.03]} />;
  return <Ball colour={look.fur} radius={0.07} position={[0, 0.02, 0]} />;
}

/** The tail sways from its root at the back of the body. */
function Tail({ kind, look }: { kind: KindId; look: BearLook }) {
  return (
    <group name={PART.tail} position={[0, 0.2, -0.27]}>
      <TailShape kind={kind} look={look} />
    </group>
  );
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
      {([-1, 1] as const).map((side, index) => (
        <group key={side}>
          <Arm side={side} index={index as 0 | 1} colour={sleeves ?? look.limbs} />
          <Leg side={side} index={index as 0 | 1} look={look} />
        </group>
      ))}
      <Tail kind={kind} look={look} />
    </group>
  );
}
