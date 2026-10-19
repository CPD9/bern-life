// A low-poly toy figure from three.js primitives only, feet on y = 0 and facing +z: a big head on a
// small body, short wide legs in chunky shoes, and big round hands. Low segment counts and flat
// shading give the faceted look and keep it cheap enough to walk the map. Legs hang from the hip
// and arms from the shoulder, so the walk can swing them (person-motion.ts).

import { type ThreeElements } from "@react-three/fiber";
import { type ReactNode } from "react";
import { DoubleSide } from "three";
import { type Motion } from "./bear-motion";
import { type PersonConfig } from "./person-config";
import { PersonFace } from "./person-face";
import { Hair } from "./person-hair";
import { meshParameters } from "./person-mesh";
import { PERSON_PART, usePersonMotion } from "./use-person-motion";

const SEGMENTS = 8;
/** Feet are squashed low-poly spheres: round, chunky and slightly turned out. */
const FOOT_SQUASH = 0.62;
/** Arms hang slightly away from the body, like a toy's. */
const ARM_SPREAD = 0.45;

type Part = { colour: string; shadows: boolean; children: ReactNode };

function Solid({ colour, shadows, children, ...placement }: Part & ThreeElements["mesh"]) {
  return (
    <mesh castShadow={shadows} {...placement}>
      {children}
      <meshLambertMaterial color={colour} flatShading />
    </mesh>
  );
}

function OpenCylinder({
  colour,
  shadows,
  y,
  top,
  bottom,
  height,
  gap,
}: {
  colour: string;
  shadows: boolean;
  y: number;
  top: number;
  bottom: number;
  height: number;
  gap: number;
}) {
  // Open towards +z, so the shirt shows through the front of a coat or vest.
  return (
    <mesh castShadow={shadows} position-y={y} scale={[1, 1, 0.8]}>
      <cylinderGeometry
        args={[top, bottom, height, SEGMENTS, 1, true, gap / 2, Math.PI * 2 - gap]}
      />
      <meshLambertMaterial color={colour} flatShading side={DoubleSide} />
    </mesh>
  );
}

type PersonFigureProps = { config: PersonConfig; shadows: boolean; motion?: Motion };

export function PersonFigure({ config, shadows, motion = "still" }: PersonFigureProps) {
  const root = usePersonMotion(motion);
  const p = meshParameters(config);
  const footRadius = p.legs.radius * 1.45;
  const footHeight = footRadius * 2 * FOOT_SQUASH;
  const legBottom = footHeight * 0.6;
  const legCentre = legBottom + p.legs.radius + p.legs.length / 2;
  const hipTop = legBottom + p.legs.length + p.legs.radius * 2;
  const hip = legCentre + p.legs.length / 2;
  const torsoCentre = hipTop - p.torso.radius * 0.5 + p.torso.radius + p.torso.length / 2;
  const shoulder = torsoCentre + p.torso.length / 2 + p.torso.radius * 0.3;
  const headCentre = torsoCentre + p.torso.length / 2 + p.torso.radius + p.head.radius * 0.75;
  const legX = p.legs.gap / 2 + p.legs.radius;
  const armLength = p.arms.length + p.arms.radius * 2;

  return (
    <group ref={root}>
      {[-1, 1].map((side) => (
        <group key={side}>
          <group name={PERSON_PART.legs[side < 0 ? 0 : 1]} position={[side * legX, hip, 0]}>
            <Solid
              colour={p.shoes}
              shadows={shadows}
              position={[0, footHeight / 2 - hip, 0.05]}
              rotation-y={side * 0.2}
              scale={[1, FOOT_SQUASH, 1.3]}
            >
              <sphereGeometry args={[footRadius, 6, 4]} />
            </Solid>
            <Solid colour={p.legs.colour} shadows={shadows} position={[0, legCentre - hip, 0]}>
              <capsuleGeometry args={[p.legs.radius, p.legs.length, 2, SEGMENTS]} />
            </Solid>
          </group>
          <group
            name={PERSON_PART.arms[side < 0 ? 0 : 1]}
            position={[side * p.torso.radius * 0.85, shoulder, 0]}
            rotation-z={side * ARM_SPREAD}
          >
            <Solid colour={p.arms.colour} shadows={shadows} position-y={-armLength / 2}>
              <capsuleGeometry args={[p.arms.radius, p.arms.length, 2, SEGMENTS]} />
            </Solid>
            <Solid
              colour={p.hands.colour}
              shadows={shadows}
              position-y={-armLength - p.hands.radius * 0.5}
            >
              <icosahedronGeometry args={[p.hands.radius, 1]} />
            </Solid>
          </group>
        </group>
      ))}
      <Solid colour={p.torso.colour} shadows={shadows} position-y={torsoCentre} scale={[1, 1, 0.8]}>
        <capsuleGeometry args={[p.torso.radius, p.torso.length, 2, SEGMENTS]} />
      </Solid>
      {p.coat && (
        <OpenCylinder
          colour={p.coat.colour}
          shadows={shadows}
          y={shoulder - p.coat.length / 2}
          top={p.torso.radius * 1.08}
          bottom={p.torso.radius * 1.35}
          height={p.coat.length}
          gap={0.9}
        />
      )}
      {p.vest && (
        <OpenCylinder
          colour={p.vest.colour}
          shadows={shadows}
          y={torsoCentre}
          top={p.torso.radius * 1.06}
          bottom={p.torso.radius * 1.1}
          height={p.torso.length + p.torso.radius}
          gap={1.1}
        />
      )}
      {p.tie && (
        <Solid
          colour={p.tie.colour}
          shadows={false}
          position={[0, torsoCentre + p.torso.radius * 0.2, p.torso.radius * 0.8]}
        >
          <boxGeometry args={[0.05, p.torso.length + p.torso.radius * 0.8, 0.02]} />
        </Solid>
      )}
      <group position-y={headCentre}>
        <Solid colour={p.head.colour} shadows={shadows}>
          <icosahedronGeometry args={[p.head.radius, 2]} />
        </Solid>
        <PersonFace headRadius={p.head.radius} eyes={p.eyes} />
        <Hair hair={p.hair} headRadius={p.head.radius} />
      </group>
    </group>
  );
}
