// A calm, happy face on the front of the head (+z): closed eyes drawn as small arcs, soft blush and
// a small mouth. The eye colour comes from the mesh mapping, light on the deepest skin tones.

const BLUSH = "#e88a8a";
const MOUTH = "#b8505a";

/** How far a point at (x, y) on the head's sphere sits in front of its centre. */
function surfaceZ(radius: number, x: number, y: number): number {
  return Math.sqrt(Math.max(0, radius * radius - x * x - y * y));
}

function Flat({ colour, opacity = 1 }: { colour: string; opacity?: number }) {
  return (
    <meshLambertMaterial color={colour} flatShading transparent={opacity < 1} opacity={opacity} />
  );
}

export function PersonFace({ headRadius, eyes }: { headRadius: number; eyes: string }) {
  const h = headRadius;
  const eyeX = h * 0.34;
  const eyeY = -h * 0.02;
  const cheekX = h * 0.52;
  const cheekY = -h * 0.22;
  const mouthY = -h * 0.36;

  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* The upper half of a thin torus reads as a closed, smiling eye. */}
          <mesh
            position={[side * eyeX, eyeY, surfaceZ(h, eyeX, eyeY) - h * 0.01]}
            rotation-y={side * 0.35}
          >
            <torusGeometry args={[h * 0.11, h * 0.028, 4, 8, Math.PI]} />
            <Flat colour={eyes} />
          </mesh>
          <mesh
            position={[side * cheekX, cheekY, surfaceZ(h, cheekX, cheekY) - h * 0.02]}
            rotation-y={side * 0.55}
            scale={[1.3, 0.75, 0.3]}
          >
            <sphereGeometry args={[h * 0.09, 8, 6]} />
            <Flat colour={BLUSH} opacity={0.55} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, mouthY, surfaceZ(h, 0, mouthY)]} scale={[1.4, 0.6, 0.4]}>
        <sphereGeometry args={[h * 0.06, 8, 6]} />
        <Flat colour={MOUTH} />
      </mesh>
    </group>
  );
}
