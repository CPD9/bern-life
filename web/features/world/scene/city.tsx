// Generic buildings and trees as instanced meshes: a few hundred boxes cost one draw call each kind.

import { useLayoutEffect, useRef } from "react";
import { Color, type InstancedMesh, Object3D } from "three";
import { type Block } from "../city-plan";
import { BRIDGES, type MapPoint } from "../geography";
import { type WorldPalette } from "../palette";

const scratch = new Object3D();
const tint = new Color();

function Blocks({ blocks, palette, shadows }: CityProps & { blocks: readonly Block[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (target === null) return;
    blocks.forEach((block, index) => {
      scratch.position.set(block.x, block.height / 2, block.z);
      scratch.scale.set(block.width, block.height, block.depth);
      scratch.updateMatrix();
      target.setMatrixAt(index, scratch.matrix);
      target.setColorAt(index, tint.set(palette.blockTones[block.tone] ?? palette.road));
    });
    target.instanceMatrix.needsUpdate = true;
    if (target.instanceColor !== null) target.instanceColor.needsUpdate = true;
  }, [blocks, palette]);
  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, blocks.length]}
      castShadow={shadows}
      receiveShadow={shadows}
    >
      <boxGeometry />
      <meshLambertMaterial />
    </instancedMesh>
  );
}

function TreeLayer({ trees, palette, shadows }: CityProps & { trees: readonly MapPoint[] }) {
  const trunks = useRef<InstancedMesh>(null);
  const crowns = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    trees.forEach(([x, z], index) => {
      const size = 0.8 + (index % 5) * 0.1;
      scratch.scale.set(size, size, size);
      scratch.position.set(x, 0.3 * size, z);
      scratch.updateMatrix();
      trunks.current?.setMatrixAt(index, scratch.matrix);
      scratch.position.set(x, 1.15 * size, z);
      scratch.updateMatrix();
      crowns.current?.setMatrixAt(index, scratch.matrix);
    });
    for (const layer of [trunks.current, crowns.current]) {
      if (layer !== null) layer.instanceMatrix.needsUpdate = true;
    }
  }, [trees]);
  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, trees.length]} castShadow={shadows}>
        <cylinderGeometry args={[0.1, 0.14, 0.6, 5]} />
        <meshLambertMaterial color={palette.trunk} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[undefined, undefined, trees.length]} castShadow={shadows}>
        <coneGeometry args={[0.65, 1.4, 6]} />
        <meshLambertMaterial color={palette.crown} flatShading />
      </instancedMesh>
    </group>
  );
}

function Bridges({ palette, shadows }: CityProps) {
  return (
    <group>
      {Object.entries(BRIDGES).map(([id, [[ax, az], [bx, bz]]]) => (
        <mesh
          key={id}
          position={[(ax + bx) / 2, 0.35, (az + bz) / 2]}
          rotation-y={-Math.atan2(bz - az, bx - ax)}
          castShadow={shadows}
          receiveShadow={shadows}
        >
          <boxGeometry args={[Math.hypot(bx - ax, bz - az), 0.4, 1.5]} />
          <meshLambertMaterial color={palette.bridge} />
        </mesh>
      ))}
    </group>
  );
}

type CityProps = { palette: WorldPalette; shadows: boolean };

export function City({
  blocks,
  trees,
  palette,
  shadows,
}: CityProps & { blocks: readonly Block[]; trees: readonly MapPoint[] }) {
  return (
    <group>
      <Blocks blocks={blocks} palette={palette} shadows={shadows} />
      <TreeLayer trees={trees} palette={palette} shadows={shadows} />
      <Bridges palette={palette} shadows={shadows} />
    </group>
  );
}
