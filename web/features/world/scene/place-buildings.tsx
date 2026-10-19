// Each building that holds a unit from sources/ stands on its own small campus plate, the same size
// for every unit, so a small institute is as easy to find as a large one. After a search, buildings
// with results glow from inside by their best rank. In walk mode a click on one walks you to its door.

import { type Building } from "../buildings";
import { PLACE_BUILDING } from "../drawn-city";
import { type Lighting } from "../light";
import { type WorldPalette } from "../palette";
import { walkClick } from "./walk-click";

const { size, height, plate } = PLACE_BUILDING;
const GLOW_COLOUR = "#2fb36b";

export function PlaceBuildings({
  buildings,
  palette,
  shadows,
  lighting,
  onWalkToDoor,
}: {
  buildings: readonly Building[];
  palette: WorldPalette;
  shadows: boolean;
  lighting: Lighting | null;
  /** Walks you to a building's door, by its key, in walk mode. */
  onWalkToDoor: ((key: string) => void) | undefined;
}) {
  return buildings.map((building) => {
    const glow = lighting?.byBuilding.get(building.key)?.glow ?? 0;
    const toDoor = onWalkToDoor === undefined ? undefined : () => onWalkToDoor(building.key);
    return (
      <group key={building.key} position={[building.x, 0, building.z]}>
        <mesh position-y={0.05} receiveShadow={shadows}>
          <boxGeometry args={[plate, 0.1, plate]} />
          <meshLambertMaterial color={palette.campus} />
        </mesh>
        <mesh
          position-y={height / 2}
          castShadow={shadows}
          receiveShadow={shadows}
          {...walkClick(toDoor)}
        >
          <boxGeometry args={[size, height, size]} />
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
