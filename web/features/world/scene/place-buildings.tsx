// Each building that holds a unit from sources/ stands on its own small campus plate, the same size
// for every unit, so a small institute is as easy to find as a large one. After a search, buildings
// with results glow from inside by their best rank.

import { type Building } from "../buildings";
import { type Lighting } from "../light";
import { type WorldPalette } from "../palette";

const BUILDING_HEIGHT = 2.8;
const GLOW_COLOUR = "#2fb36b";

export function PlaceBuildings({
  buildings,
  palette,
  shadows,
  lighting,
}: {
  buildings: readonly Building[];
  palette: WorldPalette;
  shadows: boolean;
  lighting: Lighting | null;
}) {
  return buildings.map((building) => {
    const glow = lighting?.byBuilding.get(building.key)?.glow ?? 0;
    return (
      <group key={building.key} position={[building.x, 0, building.z]}>
        <mesh position-y={0.05} receiveShadow={shadows}>
          <boxGeometry args={[4.6, 0.1, 4.6]} />
          <meshLambertMaterial color={palette.campus} />
        </mesh>
        <mesh position-y={BUILDING_HEIGHT / 2} castShadow={shadows} receiveShadow={shadows}>
          <boxGeometry args={[2.6, BUILDING_HEIGHT, 2.6]} />
          <meshLambertMaterial
            color={palette.placeBuilding[building.kind]}
            emissive={GLOW_COLOUR}
            emissiveIntensity={glow * 0.6}
          />
        </mesh>
      </group>
    );
  });
}
