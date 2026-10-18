// The five buildings a Bern local looks for first, each built from a handful of primitives at its
// point in LANDMARKS. Sizes are exaggerated a little (the Münster spire most) so they read from
// the default camera; footprints cover every part, so houses, blocks and trees keep clear.

import { LANDMARKS, type LandmarkId } from "../geography";
import { type LandmarkTone } from "../palette";
import { type Footprint } from "./footprint";

export type PartShape = "box" | "gable" | "hip" | "cylinder" | "cone" | "dome";

/** One primitive in the landmark's own frame: `at` is the centre of its base, `size` its box. */
export type Part = {
  readonly shape: PartShape;
  readonly tone: LandmarkTone;
  readonly at: readonly [x: number, y: number, z: number];
  readonly size: readonly [width: number, height: number, depth: number];
};

export type Landmark = {
  readonly id: LandmarkId;
  readonly footprint: Footprint;
  readonly parts: readonly Part[];
};

function landmark(
  id: LandmarkId,
  [width, depth]: readonly [number, number],
  parts: readonly Part[],
): Landmark {
  const [x, z] = LANDMARKS[id];
  return { id, footprint: { x, z, width, depth, angle: 0 }, parts };
}

function part(shape: PartShape, tone: LandmarkTone, at: Part["at"], size: Part["size"]): Part {
  return { shape, tone, at, size };
}

const ZYTGLOGGE = landmark(
  "zytglogge",
  [1.1, 1.1],
  [
    part("box", "stone", [0, 0, 0], [1, 3, 1]),
    part("hip", "roof", [0, 3, 0], [1.1, 1.3, 1.1]),
    part("cone", "slate", [0, 4.3, 0], [0.14, 0.5, 0.14]),
    part("box", "clock", [-0.5, 1.5, 0], [0.08, 0.55, 0.55]),
    part("box", "clock", [0.5, 1.5, 0], [0.08, 0.55, 0.55]),
  ],
);

/** Nave running east, the tower and its spire at the west end. */
const MUENSTER = landmark(
  "muenster",
  [5.4, 1.8],
  [
    part("box", "stone", [0.15, 0, 0], [3.6, 1.7, 1.6]),
    part("gable", "roof", [0.15, 1.7, 0], [3.6, 1, 1.7]),
    part("cylinder", "stone", [1.95, 0, 0], [1.3, 1.5, 1.3]),
    part("box", "stone", [-2.15, 0, 0], [1, 4.4, 1]),
    part("cylinder", "stone", [-2.15, 4.4, 0], [0.85, 0.9, 0.85]),
    part("cone", "stone", [-2.15, 5.3, 0], [0.8, 1.9, 0.8]),
  ],
);

/** The parliament under its copper dome between the west and east wings. */
const BUNDESHAUS = landmark(
  "bundeshaus",
  [10.4, 2.4],
  [
    part("box", "stone", [0, 0, 0], [3.4, 1.8, 2.4]),
    part("hip", "copper", [0, 1.8, 0], [3.4, 0.5, 2.4]),
    part("cylinder", "stone", [0, 1.8, 0], [1.3, 0.6, 1.3]),
    part("dome", "copper", [0, 2.4, 0], [1.4, 0.9, 1.4]),
    part("cone", "copper", [0, 3.3, 0], [0.3, 0.5, 0.3]),
    part("box", "stone", [-3.5, 0, 0], [3.4, 1.5, 2]),
    part("hip", "copper", [-3.5, 1.5, 0], [3.4, 0.5, 2]),
    part("box", "stone", [3.5, 0, 0], [3.4, 1.5, 2]),
    part("hip", "copper", [3.5, 1.5, 0], [3.4, 0.5, 2]),
  ],
);

/** The University's main building on the Grosse Schanze, its centre raised under a tall roof. */
const HAUPTGEBAEUDE = landmark(
  "hauptgebaeude",
  [4, 1.4],
  [
    part("box", "stone", [0, 0, 0], [4, 1.5, 1.3]),
    part("hip", "slate", [0, 1.5, 0], [4, 0.5, 1.3]),
    part("box", "stone", [0, 0, 0], [1.1, 2.3, 1.4]),
    part("hip", "slate", [0, 2.3, 0], [1.1, 0.8, 1.4]),
  ],
);

/** A long, low hall with a glass band under a flat roof. */
const BAHNHOF = landmark(
  "bahnhof",
  [4.6, 2],
  [
    part("box", "stone", [0, 0, 0], [4.4, 1.1, 1.8]),
    part("box", "glass", [0, 0.3, 0], [4.42, 0.4, 1.82]),
    part("box", "slate", [0, 1.1, 0], [4.6, 0.12, 2]),
  ],
);

export const LANDMARK_BUILDINGS: readonly Landmark[] = [
  ZYTGLOGGE,
  MUENSTER,
  BUNDESHAUS,
  HAUPTGEBAEUDE,
  BAHNHOF,
];
