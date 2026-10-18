// Each building that holds a unit from sources/ stands on its own small campus plate, the same size
// for every unit, so a small institute is as easy to find as a large one.

import { type Building } from "../buildings";
import { type WorldPalette } from "../palette";

const BUILDING_HEIGHT = 2.8;

export function PlaceBuildings({
  buildings,
  palette,
  shadows,
}: {
  buildings: readonly Building[];
  palette: WorldPalette;
  shadows: boolean;
}) {
  return buildings.map((building) => (
    <group key={building.key} position={[building.x, 0, building.z]}>
      <mesh position-y={0.05} receiveShadow={shadows}>
        <boxGeometry args={[4.6, 0.1, 4.6]} />
        <meshLambertMaterial color={palette.campus} />
      </mesh>
      <mesh position-y={BUILDING_HEIGHT / 2} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[2.6, BUILDING_HEIGHT, 2.6]} />
        <meshLambertMaterial color={palette.placeBuilding[building.kind]} />
      </mesh>
    </group>
  ));
}
