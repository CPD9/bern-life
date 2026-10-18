// A low-poly figure from three.js primitives only, feet on y = 0 and facing +z. Low segment counts
// and flat shading give the faceted look and keep it cheap enough to stand on the map later.

import { type ThreeElements } from "@react-three/fiber";
import { type ReactNode } from "react";
import { DoubleSide } from "three";
import { type AvatarConfig } from "./avatar-config";
import { Hair } from "./avatar-hair";
import { meshParameters } from "./avatar-mesh";

const SEGMENTS = 10;
const SOLE = 0.05;
const EYE_COLOUR = "#1f2329";

type Part = { colour: string; shadows: boolean; children: ReactNode };

function Material({ colour }: { colour: string }) {
  return <meshLambertMaterial color={colour} flatShading />;
}

function Solid({ colour, shadows, children, ...placement }: Part & ThreeElements["mesh"]) {
  return (
    <mesh castShadow={shadows} {...placement}>
      {children}
      <Material colour={colour} />
    </mesh>
  );
}

export function AvatarFigure({ config, shadows }: { config: AvatarConfig; shadows: boolean }) {
  const p = meshParameters(config);
  const legCentre = SOLE + p.legs.radius + p.legs.length / 2;
  const hipTop = SOLE + p.legs.length + p.legs.radius * 2;
  const torsoCentre = hipTop - p.torso.radius * 0.6 + p.torso.radius + p.torso.length / 2;
  const shoulder = torsoCentre + p.torso.length / 2 + p.torso.radius * 0.4;
  const headCentre = torsoCentre + p.torso.length / 2 + p.torso.radius + p.head.radius * 0.85;
  const legX = p.legs.gap / 2 + p.legs.radius;
  const armX = p.torso.radius + p.arms.radius * 0.9;
  const torsoFront = p.torso.radius * 0.72;

  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side}>
          <Solid colour={p.shoes} shadows={shadows} position={[side * legX, 0.04, 0.03]}>
            <boxGeometry args={[p.legs.radius * 2.2, 0.08, 0.2]} />
          </Solid>
          <Solid colour={p.legs.colour} shadows={shadows} position={[side * legX, legCentre, 0]}>
            <capsuleGeometry args={[p.legs.radius, p.legs.length, 3, SEGMENTS]} />
          </Solid>
          <Solid
            colour={p.arms.colour}
            shadows={shadows}
            position={[side * armX, shoulder - p.arms.length / 2 - p.arms.radius * 0.2, 0]}
            rotation-z={side * 0.08}
          >
            <capsuleGeometry args={[p.arms.radius, p.arms.length, 3, SEGMENTS]} />
          </Solid>
        </group>
      ))}
      <Solid
        colour={p.torso.colour}
        shadows={shadows}
        position-y={torsoCentre}
        scale={[1, 1, 0.75]}
      >
        <capsuleGeometry args={[p.torso.radius, p.torso.length, 3, SEGMENTS]} />
      </Solid>
      {p.coat && (
        <mesh castShadow={shadows} position-y={shoulder - p.coat.length / 2} scale={[1, 1, 0.78]}>
          <cylinderGeometry
            args={[
              p.torso.radius * 1.1,
              p.torso.radius * 1.3,
              p.coat.length,
              SEGMENTS,
              1,
              true,
              0.4,
              Math.PI * 2 - 0.8,
            ]}
          />
          <meshLambertMaterial color={p.coat.colour} flatShading side={DoubleSide} />
        </mesh>
      )}
      {p.vest && (
        <mesh castShadow={shadows} position-y={torsoCentre} scale={[1, 1, 0.78]}>
          <cylinderGeometry
            args={[
              p.torso.radius * 1.08,
              p.torso.radius * 1.12,
              p.torso.length + p.torso.radius,
              SEGMENTS,
              1,
              true,
              0.5,
              Math.PI * 2 - 1,
            ]}
          />
          <meshLambertMaterial color={p.vest.colour} flatShading side={DoubleSide} />
        </mesh>
      )}
      {p.tie && (
        <Solid colour={p.tie.colour} shadows={false} position={[0, torsoCentre, torsoFront]}>
          <boxGeometry args={[0.05, p.torso.length * 0.8, 0.02]} />
        </Solid>
      )}
      <group position-y={headCentre}>
        <Solid colour={p.head.colour} shadows={shadows}>
          <sphereGeometry args={[p.head.radius, SEGMENTS, 8]} />
        </Solid>
        {[-1, 1].map((side) => (
          <Solid
            key={side}
            colour={EYE_COLOUR}
            shadows={false}
            position={[side * p.head.radius * 0.35, 0.01, p.head.radius * 0.92]}
          >
            <sphereGeometry args={[p.head.radius * 0.1, 6, 4]} />
          </Solid>
        ))}
        <Hair hair={p.hair} headRadius={p.head.radius} />
      </group>
    </group>
  );
}
