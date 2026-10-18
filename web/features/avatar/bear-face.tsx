// The face on the front of the head: eyes in the chosen style, a small smile and soft blush. Head
// coordinates, centred on the head.

import { type FaceId } from "./bear-config";
import { DARK_EYES } from "./bear-look";
import { headSurfaceZ } from "./bear-shape";
import { Ball } from "./plush";
import { PART } from "./use-bear-motion";

const EYE_X = 0.13;
const EYE_Y = 0.05;
const CATCHLIGHT = "#ffffff";
const BLUSH = "#ee8f8f";

type EyeStyle = "open" | "closed-happy" | "closed-sleepy";

type EyeProps = { side: 1 | -1; style: EyeStyle; colour: string };

function Eye({ side, style, colour }: EyeProps) {
  const x = side * EYE_X;
  const z = headSurfaceZ(x, EYE_Y);
  if (style === "open") {
    // Open eyes blink by squashing in height; the pose maths sets the scale.
    return (
      <group name={PART.eyes[side === -1 ? 0 : 1]} position={[x, EYE_Y, z - 0.01]}>
        <Ball colour={colour} radius={0.05} scale={[0.85, 1, 0.5]} />
        {colour === DARK_EYES && (
          <Ball colour={CATCHLIGHT} radius={0.016} position={[0.015, 0.02, 0.025]} />
        )}
      </group>
    );
  }
  // Half a thin torus: ∩ reads as a happy closed eye, ∪ as a sleepy, content one.
  return (
    <mesh
      position={[x, EYE_Y, z]}
      rotation={[0, side * 0.35, style === "closed-sleepy" ? Math.PI : 0]}
    >
      <torusGeometry args={[0.042, 0.012, 6, 16, Math.PI]} />
      <meshLambertMaterial color={colour} />
    </mesh>
  );
}

const EYES: Readonly<Record<FaceId, readonly [EyeStyle, EyeStyle]>> = {
  happy: ["closed-happy", "closed-happy"],
  bright: ["open", "open"],
  sleepy: ["closed-sleepy", "closed-sleepy"],
  wink: ["open", "closed-happy"],
};

type FaceProps = { face: FaceId; eyes: string; mouth: string };

export function BearFace({ face, eyes, mouth }: FaceProps) {
  const [left, right] = EYES[face];
  return (
    <group>
      <Eye side={-1} style={left} colour={eyes} />
      <Eye side={1} style={right} colour={eyes} />
      {[-1, 1].map((side) => (
        <Ball
          key={side}
          colour={BLUSH}
          radius={0.05}
          opacity={0.5}
          position={[side * 0.22, -0.05, headSurfaceZ(side * 0.22, -0.05) - 0.02]}
          scale={[1.2, 0.75, 0.3]}
        />
      ))}
      <mesh position={[0, -0.135, headSurfaceZ(0, -0.135) + 0.075]} rotation-z={Math.PI}>
        <torusGeometry args={[0.03, 0.009, 6, 14, Math.PI]} />
        <meshLambertMaterial color={mouth} />
      </mesh>
    </group>
  );
}
