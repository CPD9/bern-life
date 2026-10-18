// Fills the districts with generic buildings and the open ground with trees. The layout is seeded,
// so it never changes between loads, and it keeps clear of the river, the roads, the square where
// the agents stand and every place site, so a place's own building is never hidden in a block.

import { type DistrictId, type MapPoint } from "./geography";
import { distanceToPolyline, pointInPolygon, polygonBounds } from "./geometry";
import { seededRandom } from "./random";

export type Block = {
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  readonly tone: number;
};

export type CityPlan = { readonly blocks: readonly Block[]; readonly trees: readonly MapPoint[] };

export type CityInput = {
  readonly districts: readonly { id: DistrictId; outline: readonly MapPoint[] }[];
  readonly river: readonly MapPoint[];
  readonly roads: readonly (readonly MapPoint[])[];
  readonly sites: readonly MapPoint[];
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  readonly seed: number;
};

export const CLEARANCE = { river: 3.5, road: 1.8, site: 3.2 } as const;
export const BLOCK_TONES = 4;

const BLOCK_STEP = 3;
const TREE_STEP = 5;

/** Old Town roofs stay low and even; the outer districts mix low housing with taller blocks. */
const HEIGHTS: Readonly<Record<DistrictId, readonly [number, number]>> = {
  "old-town": [1.4, 2],
  "grosse-schanze": [1, 2.2],
  insel: [1.2, 3.4],
  laenggasse: [0.9, 2.4],
  "laenggasse-north": [0.8, 2],
  kirchenfeld: [0.9, 1.8],
  lorraine: [0.9, 2.2],
  mattenhof: [0.9, 2.6],
  liebefeld: [0.7, 1.6],
};

function isClear(point: MapPoint, input: CityInput): boolean {
  if (distanceToPolyline(point, input.river) < CLEARANCE.river) return false;
  if (input.roads.some((road) => distanceToPolyline(point, road) < CLEARANCE.road)) return false;
  return input.sites.every(([x, z]) => Math.hypot(point[0] - x, point[1] - z) >= CLEARANCE.site);
}

function districtBlocks(
  district: CityInput["districts"][number],
  input: CityInput,
  random: () => number,
): { blocks: Block[]; trees: MapPoint[] } {
  const blocks: Block[] = [];
  const trees: MapPoint[] = [];
  const box = polygonBounds(district.outline);
  const [low, high] = HEIGHTS[district.id];
  for (let x = box.minX + BLOCK_STEP / 2; x < box.maxX; x += BLOCK_STEP) {
    for (let z = box.minZ + BLOCK_STEP / 2; z < box.maxZ; z += BLOCK_STEP) {
      const jitter: MapPoint = [x + (random() - 0.5) * 0.6, z + (random() - 0.5) * 0.6];
      const roll = random();
      if (!pointInPolygon(jitter, district.outline) || !isClear(jitter, input)) continue;
      if (roll < 0.72) {
        blocks.push({
          x: jitter[0],
          z: jitter[1],
          width: 1.5 + random() * 0.9,
          depth: 1.5 + random() * 0.9,
          height: low + random() * (high - low),
          tone: Math.floor(random() * BLOCK_TONES),
        });
      } else if (roll < 0.86) {
        trees.push(jitter);
      }
    }
  }
  return { blocks, trees };
}

function openGroundTrees(input: CityInput, random: () => number): MapPoint[] {
  const trees: MapPoint[] = [];
  const { minX, maxX, minZ, maxZ } = input.bounds;
  for (let x = minX + TREE_STEP / 2; x < maxX; x += TREE_STEP) {
    for (let z = minZ + TREE_STEP / 2; z < maxZ; z += TREE_STEP) {
      const point: MapPoint = [x + (random() - 0.5) * 3, z + (random() - 0.5) * 3];
      const roll = random();
      const inDistrict = input.districts.some((d) => pointInPolygon(point, d.outline));
      if (roll < 0.4 && !inDistrict && isClear(point, input)) trees.push(point);
    }
  }
  return trees;
}

export function planCity(input: CityInput): CityPlan {
  const random = seededRandom(input.seed);
  const parts = input.districts.map((district) => districtBlocks(district, input, random));
  return {
    blocks: parts.flatMap((part) => part.blocks),
    trees: [...parts.flatMap((part) => part.trees), ...openGroundTrees(input, random)],
  };
}

/** Lite graphics keeps every third tree. */
export function liteTrees(trees: readonly MapPoint[]): readonly MapPoint[] {
  return trees.filter((_, index) => index % 3 === 0);
}
