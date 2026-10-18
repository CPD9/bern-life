// Landmarks and bridges never move, so they are baked into a single geometry with colours per
// vertex: Zytglogge, Münster, Bundeshaus, the University and the station, and five arched bridges
// cost one draw call between them. Lite graphics rounds domes, spires and arches with fewer sides.

import { useEffect, useMemo } from "react";
import { BoxGeometry, type BufferGeometry, ExtrudeGeometry, Matrix4, Shape, Vector2 } from "three";
import { BRIDGE_ARCHES, BRIDGES } from "../geography";
import { type WorldPalette } from "../palette";
import { BRIDGE_WIDTH, type Bridge, planBridges } from "./bridge-plan";
import { type Footprint } from "./footprint";
import { type Landmark, LANDMARK_BUILDINGS } from "./landmark-plan";
import { type Coloured, mergeColoured, partGeometry } from "./meshes";

const PIER_FOOTING = { width: 0.9, height: 0.35, overhang: 0.4 } as const;

function frameOf(footprint: Footprint): Matrix4 {
  return new Matrix4()
    .makeTranslation(footprint.x, 0, footprint.z)
    .multiply(new Matrix4().makeRotationY(footprint.angle));
}

function landmarkPieces(landmark: Landmark, palette: WorldPalette, segments: number): Coloured[] {
  const frame = frameOf(landmark.footprint);
  return landmark.parts.map((part) => ({
    geometry: partGeometry(part, segments, frame),
    colour: palette.landmark[part.tone],
  }));
}

function bridgePieces(bridge: Bridge, palette: WorldPalette): Coloured[] {
  const frame = frameOf(bridge.footprint);
  const half = bridge.footprint.width / 2;
  const side = new Shape(bridge.profile.outline.map(([x, y]) => new Vector2(x, y)));
  const deck = new ExtrudeGeometry(side, { depth: BRIDGE_WIDTH, bevelEnabled: false })
    .translate(-half, 0, -BRIDGE_WIDTH / 2)
    .applyMatrix4(frame);
  const footings = bridge.profile.piers.map((pier) =>
    new BoxGeometry(PIER_FOOTING.width, PIER_FOOTING.height, BRIDGE_WIDTH + PIER_FOOTING.overhang)
      .translate(pier - half, PIER_FOOTING.height / 2, 0)
      .applyMatrix4(frame),
  );
  return [
    { geometry: deck, colour: palette.bridge },
    ...footings.map((geometry) => ({ geometry, colour: palette.pier })),
  ];
}

export function Landmarks({
  palette,
  shadows,
  lite,
}: {
  palette: WorldPalette;
  shadows: boolean;
  lite: boolean;
}) {
  const geometry: BufferGeometry = useMemo(() => {
    const segments = lite ? 8 : 16;
    const bridges = planBridges(BRIDGES, BRIDGE_ARCHES, lite ? 5 : 12);
    return mergeColoured([
      ...LANDMARK_BUILDINGS.flatMap((landmark) => landmarkPieces(landmark, palette, segments)),
      ...bridges.flatMap((bridge) => bridgePieces(bridge, palette)),
    ]);
  }, [palette, lite]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow={shadows} receiveShadow={shadows}>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}
