// The Old Town's houses as two instanced meshes, walls and roofs: some six hundred houses cost two
// draw calls. Roof ridges run along the row, eaves to the street, as on Kramgasse.

import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, type InstancedMesh, Object3D } from "three";
import { type WorldPalette } from "../palette";
import { gableRoofGeometry } from "./meshes";
import { type House } from "./old-town-plan";
import { type OnWalkClick, walkClick } from "./walk-click";

const ROOF_HEIGHT = 0.55;
const EAVES = 0.12;

const scratch = new Object3D();
const tint = new Color();

export function OldTownHouses({
  houses,
  palette,
  shadows,
  onWalk,
}: {
  houses: readonly House[];
  palette: WorldPalette;
  shadows: boolean;
  onWalk: OnWalkClick;
}) {
  const walls = useRef<InstancedMesh>(null);
  const roofs = useRef<InstancedMesh>(null);
  const roofGeometry = useMemo(() => gableRoofGeometry(), []);

  useLayoutEffect(() => {
    const wallMesh = walls.current;
    const roofMesh = roofs.current;
    if (wallMesh === null || roofMesh === null) return;
    houses.forEach((house, index) => {
      scratch.rotation.set(0, house.angle, 0);
      scratch.position.set(house.x, house.height / 2, house.z);
      scratch.scale.set(house.width, house.height, house.depth);
      scratch.updateMatrix();
      wallMesh.setMatrixAt(index, scratch.matrix);
      wallMesh.setColorAt(index, tint.set(palette.houseWalls[house.wall] ?? palette.road));
      scratch.position.set(house.x, house.height, house.z);
      scratch.scale.set(house.width + EAVES / 2, ROOF_HEIGHT, house.depth + EAVES);
      scratch.updateMatrix();
      roofMesh.setMatrixAt(index, scratch.matrix);
      roofMesh.setColorAt(index, tint.set(palette.roofs[house.roof] ?? palette.road));
    });
    for (const mesh of [wallMesh, roofMesh]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
    }
  }, [houses, palette]);

  return (
    <group>
      <instancedMesh
        ref={walls}
        args={[undefined, undefined, houses.length]}
        castShadow={shadows}
        receiveShadow={shadows}
        {...walkClick(onWalk)}
      >
        <boxGeometry />
        <meshLambertMaterial />
      </instancedMesh>
      <instancedMesh
        ref={roofs}
        args={[roofGeometry, undefined, houses.length]}
        castShadow={shadows}
        receiveShadow={shadows}
        {...walkClick(onWalk)}
      >
        <meshLambertMaterial flatShading />
      </instancedMesh>
    </group>
  );
}
