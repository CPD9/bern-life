// What stands on the map above the ground, for one home: the seeded blocks, the Old Town's houses,
// the landmarks, the places' buildings and your own office. The scene draws exactly this and a
// walker collides with exactly this, so what you see and where you can go never drift apart.
// Your office clears its lot of whatever the seeded city put there.

import { type Building } from "./buildings";
import { type Block, type CityPlan } from "./city-plan";
import { AARE_WIDTH, MAP_BOUNDS, type MapPoint } from "./geography";
import { DECK_HEIGHT, END_HEIGHT, RAMP } from "./scene/bridge-plan";
import { coveredByAny, type Footprint, overlaps } from "./scene/footprint";
import { LANDMARK_BUILDINGS } from "./scene/landmark-plan";
import { type House } from "./scene/old-town-plan";
import { AARE_CURVE, BRIDGE_FOOTPRINTS, CLAIMED, OLD_TOWN_HOUSES } from "./scene/town";
import { type WalkMap, walkMap } from "./walk-map";

/** Every place's building is the same box, so a small institute is as easy to find as a large one. */
export const PLACE_BUILDING = { size: 2.6, height: 2.8, plate: 4.6 } as const;

/** Your office: a small house at the back of a square lot, its door toward the default camera. */
export const HOME = { lot: 3.2, width: 1.6, depth: 1.4, height: 1.5, back: 0.6 } as const;

/** Half a generic block's widest side, and a tree crown's radius, kept off claimed ground. */
const CLAIM_MARGIN = { block: 1.3, tree: 0.7 } as const;

/** The railings stand on the deck's edges, short of the ramps, where you step on and off. */
const RAIL_THICKNESS = 0.1;

export function homeLot([x, z]: MapPoint): Footprint {
  return { x, z, width: HOME.lot, depth: HOME.lot, angle: 0 };
}

export function homeOffice([x, z]: MapPoint): Footprint {
  return { x, z: z - HOME.back, width: HOME.width, depth: HOME.depth, angle: 0 };
}

export type DrawnCity = {
  readonly blocks: readonly Block[];
  readonly houses: readonly House[];
  /** Ground the generic blocks and trees give way to. */
  readonly claimed: readonly Footprint[];
};

export function drawnCity(plan: CityPlan, home: MapPoint | null): DrawnCity {
  const claimed = home === null ? CLAIMED : [...CLAIMED, homeLot(home)];
  return {
    blocks: plan.blocks.filter(
      (block) => !coveredByAny(claimed, [block.x, block.z], CLAIM_MARGIN.block),
    ),
    houses:
      home === null
        ? OLD_TOWN_HOUSES
        : OLD_TOWN_HOUSES.filter((house) => !overlaps(homeLot(home), house)),
    claimed,
  };
}

export function shownTrees(
  trees: readonly MapPoint[],
  claimed: readonly Footprint[],
): readonly MapPoint[] {
  return trees.filter((tree) => !coveredByAny(claimed, tree, CLAIM_MARGIN.tree));
}

/** Two thin walls along a bridge's sides, so you cross it end to end and never fall off. */
export function bridgeRails(deck: Footprint): Footprint[] {
  const offset = deck.depth / 2;
  return [-1, 1].map((side) => ({
    x: deck.x + side * offset * Math.sin(deck.angle),
    z: deck.z + side * offset * Math.cos(deck.angle),
    width: deck.width - 2 * RAMP,
    depth: RAIL_THICKNESS,
    angle: deck.angle,
  }));
}

function blockFootprint(block: Block): Footprint {
  return { x: block.x, z: block.z, width: block.width, depth: block.depth, angle: 0 };
}

function placeFootprint(building: Building): Footprint {
  const { size } = PLACE_BUILDING;
  return { x: building.x, z: building.z, width: size, depth: size, angle: 0 };
}

export function cityObstacles(
  drawn: DrawnCity,
  buildings: readonly Building[],
  home: MapPoint | null,
): Footprint[] {
  return [
    ...drawn.blocks.map(blockFootprint),
    ...drawn.houses,
    ...LANDMARK_BUILDINGS.map((landmark) => landmark.footprint),
    ...buildings.map(placeFootprint),
    ...BRIDGE_FOOTPRINTS.flatMap(bridgeRails),
    ...(home === null ? [] : [homeOffice(home)]),
  ];
}

export function cityWalkMap(
  drawn: DrawnCity,
  buildings: readonly Building[],
  home: MapPoint | null,
): WalkMap {
  return walkMap({
    bounds: MAP_BOUNDS,
    obstacles: cityObstacles(drawn, buildings, home),
    river: AARE_CURVE,
    riverHalfWidth: AARE_WIDTH / 2,
    decks: BRIDGE_FOOTPRINTS,
    deck: { height: DECK_HEIGHT, endHeight: END_HEIGHT, ramp: RAMP },
  });
}
