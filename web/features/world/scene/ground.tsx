import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, DoubleSide, Shape, ShapeGeometry } from "three";
import {
  AARE_PATH,
  AARE_WIDTH,
  DISTRICTS,
  MAP_BOUNDS,
  ROADS,
  ROAD_WIDTH,
  type MapPoint,
} from "../geography";
import { type WorldPalette } from "../palette";
import { ribbon } from "../ribbon";

// Layers sit a few millimetres apart so they never flicker against each other.
const PLATE_Y = 0.02;
const ROAD_Y = 0.04;
const WATER_Y = 0.06;

function ribbonGeometry(path: readonly MapPoint[], width: number, height: number) {
  const band = ribbon(path, width, height);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(band.positions, 3));
  geometry.setIndex(new BufferAttribute(band.indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** A shape lies in its own x/y plane; turned flat, y becomes -z, so outlines are mirrored here. */
function plateGeometry(outline: readonly MapPoint[]) {
  const shape = new Shape();
  outline.forEach(([x, z], index) => (index === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  return new ShapeGeometry(shape);
}

export function Ground({ palette, shadows }: { palette: WorldPalette; shadows: boolean }) {
  const width = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const depth = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
  const plates = useMemo(
    () =>
      DISTRICTS.map((district) => ({ id: district.id, geometry: plateGeometry(district.outline) })),
    [],
  );
  const roads = useMemo(() => ROADS.map((road) => ribbonGeometry(road, ROAD_WIDTH, ROAD_Y)), []);
  const river = useMemo(() => ribbonGeometry(AARE_PATH, AARE_WIDTH, WATER_Y), []);

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[MAP_BOUNDS.minX + width / 2, 0, MAP_BOUNDS.minZ + depth / 2]}
        receiveShadow={shadows}
      >
        <planeGeometry args={[width, depth]} />
        <meshLambertMaterial color={palette.ground} />
      </mesh>
      {plates.map((plate) => (
        <mesh
          key={plate.id}
          geometry={plate.geometry}
          rotation-x={-Math.PI / 2}
          position-y={PLATE_Y}
          receiveShadow={shadows}
        >
          <meshLambertMaterial
            color={plate.id === "old-town" ? palette.oldTownPlate : palette.districtPlate}
          />
        </mesh>
      ))}
      {roads.map((geometry, index) => (
        <mesh key={index} geometry={geometry} receiveShadow={shadows}>
          <meshLambertMaterial color={palette.road} side={DoubleSide} />
        </mesh>
      ))}
      <mesh geometry={river}>
        <meshLambertMaterial color={palette.water} side={DoubleSide} />
      </mesh>
    </group>
  );
}
