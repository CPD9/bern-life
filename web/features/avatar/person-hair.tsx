// Hairstyles and the head covering, centred on the head and sized from its radius.

import { DoubleSide } from "three";
import { type MeshParameters } from "./person-mesh";

const SEGMENTS = 10;
const CURL_GAP = 1.4;

export function Hair({ hair, headRadius }: { hair: MeshParameters["hair"]; headRadius: number }) {
  const h = headRadius;
  const material = <meshLambertMaterial color={hair.colour} flatShading side={DoubleSide} />;
  // Tilted back so the fringe sits on the forehead and the eyes stay visible.
  const cap = (scale: number, cover: number) => (
    <mesh rotation-x={-0.45}>
      <sphereGeometry args={[h * scale, SEGMENTS, 8, 0, Math.PI * 2, 0, Math.PI * cover]} />
      {material}
    </mesh>
  );

  switch (hair.style) {
    case "short":
      return cap(1.07, 0.52);
    case "buzz":
      return cap(1.03, 0.45);
    case "long":
      return (
        <group>
          {cap(1.08, 0.55)}
          {/* Falls to the shoulders around the back and sides, open over the face. */}
          <mesh position-y={-h * 0.45}>
            <cylinderGeometry
              args={[h * 1.06, h * 1.12, h * 1.1, SEGMENTS, 1, true, 1.1, Math.PI * 2 - 2.2]}
            />
            {material}
          </mesh>
        </group>
      );
    case "curly":
      return (
        <group>
          {cap(1.1, 0.55)}
          {/* Curls around the crown and back, leaving the face (+z) clear. */}
          {Array.from({ length: 7 }, (_, index) => {
            const angle = CURL_GAP / 2 + (index / 6) * (Math.PI * 2 - CURL_GAP);
            return (
              <mesh
                key={angle}
                position={[
                  Math.sin(angle) * h * 0.82,
                  h * 0.42,
                  Math.cos(angle) * h * 0.82 - h * 0.1,
                ]}
              >
                <icosahedronGeometry args={[h * 0.3, 0]} />
                {material}
              </mesh>
            );
          })}
        </group>
      );
    case "bun":
      return (
        <group>
          {cap(1.07, 0.52)}
          <mesh position={[0, h * 0.8, -h * 0.55]}>
            <icosahedronGeometry args={[h * 0.42, 1]} />
            {material}
          </mesh>
        </group>
      );
    case "hood":
      // A soft hood with two round ears, open over the face like the covering.
      return (
        <group>
          <mesh>
            <sphereGeometry
              args={[
                h * 1.14,
                SEGMENTS,
                8,
                Math.PI / 2 + 0.85,
                Math.PI * 2 - 1.7,
                0,
                Math.PI * 0.72,
              ]}
            />
            {material}
          </mesh>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * h * 0.62, h * 0.92, -h * 0.1]}>
              <icosahedronGeometry args={[h * 0.3, 1]} />
              {material}
            </mesh>
          ))}
        </group>
      );
    case "covered":
      // A head covering that wraps the head and neck and leaves the face open towards +z.
      return (
        <group>
          <mesh>
            <sphereGeometry
              args={[h * 1.12, SEGMENTS, 8, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.8]}
            />
            {material}
          </mesh>
          <mesh position-y={-h * 1.1}>
            <cylinderGeometry
              args={[h * 0.8, h * 1.25, h * 0.7, SEGMENTS, 1, true, 0.9, Math.PI * 2 - 1.8]}
            />
            {material}
          </mesh>
        </group>
      );
  }
}
