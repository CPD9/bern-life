// Your office on the map: a small house on its own lot at the plot you settled on, its door facing
// the default camera. "Go home" takes you through that door; "Go outside" brings you back to it.

import { useEffect, useMemo } from "react";
import { HOME, homeLot, homeOffice } from "../drawn-city";
import { type MapPoint } from "../geography";
import { type WorldPalette } from "../palette";
import { gableRoofGeometry } from "./meshes";

const ROOF = { height: 0.6, eaves: 0.15 } as const;
const DOOR = { width: 0.42, height: 0.82, depth: 0.04, colour: "#2f4b7c" } as const;

export function HomeLot({
  home,
  palette,
  shadows,
}: {
  home: MapPoint;
  palette: WorldPalette;
  shadows: boolean;
}) {
  const lot = homeLot(home);
  const office = homeOffice(home);
  const roof = useMemo(() => gableRoofGeometry(), []);
  useEffect(() => () => roof.dispose(), [roof]);
  return (
    <group>
      <mesh position={[lot.x, 0.05, lot.z]} receiveShadow={shadows}>
        <boxGeometry args={[lot.width, 0.1, lot.depth]} />
        <meshLambertMaterial color={palette.campus} />
      </mesh>
      <group position={[office.x, 0, office.z]}>
        <mesh position-y={HOME.height / 2} castShadow={shadows} receiveShadow={shadows}>
          <boxGeometry args={[office.width, HOME.height, office.depth]} />
          <meshLambertMaterial color={palette.houseWalls[0] ?? palette.road} />
        </mesh>
        <mesh
          geometry={roof}
          position-y={HOME.height}
          scale={[office.width + ROOF.eaves, ROOF.height, office.depth + ROOF.eaves]}
          castShadow={shadows}
        >
          <meshLambertMaterial color={palette.roofs[0] ?? palette.road} flatShading />
        </mesh>
        <mesh position={[0, DOOR.height / 2, office.depth / 2 + DOOR.depth / 2]}>
          <boxGeometry args={[DOOR.width, DOOR.height, DOOR.depth]} />
          <meshLambertMaterial color={DOOR.colour} />
        </mesh>
      </group>
    </group>
  );
}
