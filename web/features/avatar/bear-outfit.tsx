// Clothes are bands of a slightly larger copy of the body sphere, so they hug the round body. The
// front stays open on the lab coat and the vest, so the belly shows through.

import { type OutfitId } from "./bear-config";
import { BODY, NECK_Y } from "./bear-shape";
import { Plush, useSegments } from "./plush";

type Band = {
  readonly colour: string;
  readonly from: number;
  readonly to: number;
  /** Width of the opening at the front, in radians; 0 closes it. */
  readonly open: number;
};

type Outfit = {
  readonly bands: readonly Band[];
  readonly sleeves: string | null;
  readonly tie: string | null;
  readonly collar: string | null;
};

export const OUTFITS: Readonly<Record<OutfitId, Outfit>> = {
  casual: {
    bands: [{ colour: "#4f9d6b", from: 0.2, to: 0.56, open: 0 }],
    sleeves: null,
    tie: null,
    collar: null,
  },
  office: {
    bands: [{ colour: "#34425a", from: 0.18, to: 0.6, open: 0.5 }],
    sleeves: "#34425a",
    tie: "#c8463d",
    collar: "#f4f6f8",
  },
  // A blue-white coat with a collar, so it still reads on a snow-white polar bear.
  "lab-coat": {
    bands: [{ colour: "#dfe8f3", from: 0.18, to: 0.86, open: 0.9 }],
    sleeves: "#dfe8f3",
    tie: null,
    collar: "#b9cbe0",
  },
  "field-work": {
    bands: [{ colour: "#6b7b4a", from: 0.18, to: 0.62, open: 1.1 }],
    sleeves: null,
    tie: null,
    collar: "#e0a030",
  },
};

function BandMesh({ band }: { band: Band }) {
  const segments = useSegments();
  // Sphere phi = π/2 points at +z, the bear's front.
  const phiStart = Math.PI / 2 + band.open / 2;
  return (
    <mesh castShadow position-y={BODY.y} scale={[...BODY.scale]}>
      <sphereGeometry
        args={[
          BODY.radius * 1.04,
          segments,
          Math.round(segments * 0.75),
          phiStart,
          Math.PI * 2 - band.open,
          Math.PI * band.from,
          Math.PI * (band.to - band.from),
        ]}
      />
      <Plush colour={band.colour} twoSided />
    </mesh>
  );
}

export function BearOutfit({ outfit }: { outfit: OutfitId }) {
  const segments = useSegments();
  const look = OUTFITS[outfit];
  return (
    <group>
      {look.bands.map((band) => (
        <BandMesh key={band.colour} band={band} />
      ))}
      {look.collar && (
        <mesh position-y={NECK_Y - 0.03} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.16, 0.03, 8, segments]} />
          <Plush colour={look.collar} />
        </mesh>
      )}
      {look.tie && (
        <mesh position={[0, 0.5, 0.27]} rotation-x={-0.25}>
          <boxGeometry args={[0.06, 0.18, 0.02]} />
          <meshLambertMaterial color={look.tie} />
        </mesh>
      )}
    </group>
  );
}
