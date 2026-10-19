// The flat layers: ground, district plates, roads, the Aare's banks and its water. Each layer is one
// merged geometry, so the whole floor of the city costs six draw calls.

import { useEffect, useMemo } from "react";
import { BufferAttribute, BufferGeometry, DoubleSide, Shape, ShapeGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  AARE_PATH,
  AARE_WIDTH,
  BANK_WIDTH,
  DISTRICTS,
  MAP_BOUNDS,
  ROADS,
  ROAD_WIDTH,
  type MapPoint,
} from "../geography";
import { useWorldDisplay } from "../display";
import { type WorldPalette } from "../palette";
import { ribbon, smoothPath } from "../ribbon";
import { AARE_CURVE, AARE_SAMPLES } from "./town";

// Layers sit a few millimetres apart so they never flicker against each other.
const PLATE_Y = 0.02;
const ROAD_Y = 0.04;
const BANK_Y = 0.05;
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
  return new ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, PLATE_Y, 0);
}

function merged(geometries: readonly BufferGeometry[]): BufferGeometry {
  const result = mergeGeometries([...geometries]);
  if (result === null) throw new Error("the map's ground layers could not be merged");
  return result;
}

function useDisposed(geometry: BufferGeometry): BufferGeometry {
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

const OLD_TOWN_PLATE = merged(
  DISTRICTS.filter((d) => d.id === "old-town").map((d) => plateGeometry(d.outline)),
);
const DISTRICT_PLATES = merged(
  DISTRICTS.filter((d) => d.id !== "old-town").map((d) => plateGeometry(d.outline)),
);
const ROAD_LAYER = merged(ROADS.map((road) => ribbonGeometry(road, ROAD_WIDTH, ROAD_Y)));

export function Ground({ palette, shadows }: { palette: WorldPalette; shadows: boolean }) {
  const { lite } = useWorldDisplay();
  const width = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
  const depth = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;
  const curve = useMemo(
    () => (lite ? smoothPath(AARE_PATH, AARE_SAMPLES.lite) : AARE_CURVE),
    [lite],
  );
  const banks = useDisposed(
    useMemo(() => ribbonGeometry(curve, AARE_WIDTH + 2 * BANK_WIDTH, BANK_Y), [curve]),
  );
  const water = useDisposed(useMemo(() => ribbonGeometry(curve, AARE_WIDTH, WATER_Y), [curve]));

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
      <mesh geometry={DISTRICT_PLATES} receiveShadow={shadows}>
        <meshLambertMaterial color={palette.districtPlate} />
      </mesh>
      <mesh geometry={OLD_TOWN_PLATE} receiveShadow={shadows}>
        <meshLambertMaterial color={palette.oldTownPlate} />
      </mesh>
      <mesh geometry={ROAD_LAYER} receiveShadow={shadows}>
        <meshLambertMaterial color={palette.road} side={DoubleSide} />
      </mesh>
      <mesh geometry={banks} receiveShadow={shadows}>
        <meshLambertMaterial color={palette.bank} side={DoubleSide} />
      </mesh>
      <mesh geometry={water}>
        <meshLambertMaterial color={palette.water} side={DoubleSide} />
      </mesh>
    </group>
  );
}
