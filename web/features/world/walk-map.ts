// Where a walker may stand. Every building is a turned rectangle, the Aare is water except on a
// bridge deck, and the edge of the map is a wall. Obstacles are filed in a coarse grid of cells, so
// a check looks only at the few near the walker instead of the whole city.

import { type MapPoint } from "./geography";
import { type Bounds } from "./geometry";
import { type Footprint } from "./scene/footprint";

/** About a city block: few obstacles per cell, few cells per obstacle. */
const CELL = 4;
/** The widest walker a check is asked about; obstacles are filed with this much room round them. */
const MAX_RADIUS = 0.5;

type Box = {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
  readonly cos: number;
  readonly sin: number;
};

type Water = { readonly ax: number; readonly az: number; readonly bx: number; readonly bz: number };

type Cell = { readonly boxes: Box[]; readonly water: Water[] };

/** A bridge deck's height along it: up a short ramp from each end, then level. */
export type DeckProfile = {
  readonly height: number;
  readonly endHeight: number;
  readonly ramp: number;
};

export type WalkMapInput = {
  readonly bounds: Bounds;
  readonly obstacles: readonly Footprint[];
  readonly river: readonly MapPoint[];
  readonly riverHalfWidth: number;
  readonly decks: readonly Footprint[];
  readonly deck: DeckProfile;
};

export type WalkMap = {
  readonly bounds: Bounds;
  readonly riverHalfWidth: number;
  readonly decks: readonly Box[];
  readonly deck: DeckProfile;
  readonly cells: ReadonlyMap<number, Cell>;
};

function box(footprint: Footprint): Box {
  return {
    x: footprint.x,
    z: footprint.z,
    halfWidth: footprint.width / 2,
    halfDepth: footprint.depth / 2,
    cos: Math.cos(footprint.angle),
    sin: Math.sin(footprint.angle),
  };
}

/** Same frame as scene/footprint.ts `covers`: local x along the width, local z along the depth. */
function local(b: Box, x: number, z: number): MapPoint {
  const dx = x - b.x;
  const dz = z - b.z;
  return [dx * b.cos - dz * b.sin, dx * b.sin + dz * b.cos];
}

function inBox(b: Box, x: number, z: number, margin: number): boolean {
  const [lx, lz] = local(b, x, z);
  return Math.abs(lx) < b.halfWidth + margin && Math.abs(lz) < b.halfDepth + margin;
}

function boxExtent(b: Box): Bounds {
  const reachX = b.halfWidth * Math.abs(b.cos) + b.halfDepth * Math.abs(b.sin);
  const reachZ = b.halfWidth * Math.abs(b.sin) + b.halfDepth * Math.abs(b.cos);
  return { minX: b.x - reachX, maxX: b.x + reachX, minZ: b.z - reachZ, maxZ: b.z + reachZ };
}

function distanceToWater(w: Water, x: number, z: number): number {
  const dx = w.bx - w.ax;
  const dz = w.bz - w.az;
  const lengthSquared = dx * dx + dz * dz;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - w.ax) * dx + (z - w.az) * dz) / lengthSquared));
  return Math.hypot(x - (w.ax + t * dx), z - (w.az + t * dz));
}

function cellIndex(bounds: Bounds, x: number, z: number): [column: number, row: number] {
  return [Math.floor((x - bounds.minX) / CELL), Math.floor((z - bounds.minZ) / CELL)];
}

function cellKey(column: number, row: number): number {
  return row * 10_000 + column;
}

function file(cells: Map<number, Cell>, bounds: Bounds, extent: Bounds, add: (cell: Cell) => void) {
  const [minColumn, minRow] = cellIndex(bounds, extent.minX - MAX_RADIUS, extent.minZ - MAX_RADIUS);
  const [maxColumn, maxRow] = cellIndex(bounds, extent.maxX + MAX_RADIUS, extent.maxZ + MAX_RADIUS);
  for (let row = minRow; row <= maxRow; row++) {
    for (let column = minColumn; column <= maxColumn; column++) {
      const key = cellKey(column, row);
      const cell = cells.get(key) ?? { boxes: [], water: [] };
      add(cell);
      cells.set(key, cell);
    }
  }
}

export function walkMap(input: WalkMapInput): WalkMap {
  const cells = new Map<number, Cell>();
  for (const obstacle of input.obstacles.map(box)) {
    file(cells, input.bounds, boxExtent(obstacle), (cell) => cell.boxes.push(obstacle));
  }
  input.river.slice(1).forEach(([bx, bz], index) => {
    const [ax, az] = input.river[index] ?? [bx, bz];
    const half = input.riverHalfWidth;
    const extent = {
      minX: Math.min(ax, bx) - half,
      maxX: Math.max(ax, bx) + half,
      minZ: Math.min(az, bz) - half,
      maxZ: Math.max(az, bz) + half,
    };
    file(cells, input.bounds, extent, (cell) => cell.water.push({ ax, az, bx, bz }));
  });
  return {
    bounds: input.bounds,
    riverHalfWidth: input.riverHalfWidth,
    decks: input.decks.map(box),
    deck: input.deck,
    cells,
  };
}

function onDeck(map: WalkMap, x: number, z: number): Box | undefined {
  return map.decks.find((deck) => inBox(deck, x, z, 0));
}

/** True when a walker of `radius` at `point` would stand in a wall, in the river or off the map. */
export function blocked(map: WalkMap, [x, z]: MapPoint, radius: number): boolean {
  const { bounds } = map;
  if (x - radius < bounds.minX || x + radius > bounds.maxX) return true;
  if (z - radius < bounds.minZ || z + radius > bounds.maxZ) return true;
  const cell = map.cells.get(cellKey(...cellIndex(bounds, x, z)));
  if (cell === undefined) return false;
  if (cell.boxes.some((b) => inBox(b, x, z, radius))) return true;
  const wet = cell.water.some((w) => distanceToWater(w, x, z) < map.riverHalfWidth);
  return wet && onDeck(map, x, z) === undefined;
}

/** How high the walker's feet are: on a bridge, the deck; anywhere else, the ground. */
export function groundHeight(map: WalkMap, [x, z]: MapPoint): number {
  const deck = onDeck(map, x, z);
  if (deck === undefined) return 0;
  const fromEnd = deck.halfWidth - Math.abs(local(deck, x, z)[0]);
  const { height, endHeight, ramp } = map.deck;
  return endHeight + (height - endHeight) * Math.min(1, Math.max(0, fromEnd / ramp));
}
