// Your office on the map: a small house on its own lot at the plot you settled on, its door facing
// the default camera. A copper roof and a gold door set it apart from the Old Town's terracotta.
// "Go home" takes you through that door; "Go outside" brings you back to it. In walk mode a click
// on the house walks you to its door.

import { useEffect, useMemo } from "react";
import { HOME, homeLot, homeOffice } from "../drawn-city";
import { type MapPoint } from "../geography";
import { type WorldPalette } from "../palette";
import { gableRoofGeometry } from "./meshes";
import { type OnWalkClick, walkClick } from "./walk-click";

const ROOF = { height: 0.6, eaves: 0.15 } as const;
/** Bärli's gold, as on the walk preview: what is yours on the map. */
const DOOR = { width: 0.6, height: 1.2, depth: 0.04, colour: "#e0a526" } as const;

export function HomeLot({
  home,
  palette,
  shadows,
  onWalkToDoor,
}: {
  home: MapPoint;
  palette: WorldPalette;
  shadows: boolean;
  /** Walks you to your door, in walk mode. */
  onWalkToDoor: OnWalkClick;
}) {
  const lot = homeLot(home);
  const office = homeOffice(home);
  const roof = useMemo(() => gableRoofGeometry(), []);
  useEffect(() => () => roof.dispose(), [roof]);
  // On each part of the house, not on the group round them, so one click is handled once.
  const click = walkClick(onWalkToDoor);
  return (
    <group>
      <mesh position={[lot.x, 0.05, lot.z]} receiveShadow={shadows}>
        <boxGeometry args={[lot.width, 0.1, lot.depth]} />
        <meshLambertMaterial color={palette.campus} />
      </mesh>
      <group position={[office.x, 0, office.z]}>
        <mesh position-y={HOME.height / 2} castShadow={shadows} receiveShadow={shadows} {...click}>
          <boxGeometry args={[office.width, HOME.height, office.depth]} />
          <meshLambertMaterial color={palette.placeBuilding.centre} />
        </mesh>
        <mesh
          geometry={roof}
          position-y={HOME.height}
          scale={[office.width + ROOF.eaves, ROOF.height, office.depth + ROOF.eaves]}
          castShadow={shadows}
          {...click}
        >
          <meshLambertMaterial color={palette.landmark.copper} flatShading />
        </mesh>
        <mesh position={[0, DOOR.height / 2, office.depth / 2 + DOOR.depth / 2]} {...click}>
          <boxGeometry args={[DOOR.width, DOOR.height, DOOR.depth]} />
          <meshLambertMaterial color={DOOR.colour} />
        </mesh>
      </group>
    </group>
  );
}
