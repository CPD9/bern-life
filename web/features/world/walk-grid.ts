// The grid click-to-walk searches: fine cells over the whole map, each open when a walker can
// stand at its centre. Open cells joined without cutting a corner form regions, so a click on a
// spot that cannot be reached (a courtyard, the middle of the river) goes to the nearest spot in
// the walker's own region instead.

import { type MapPoint } from "./geography";
import { type Bounds } from "./geometry";

export type WalkGrid = {
  readonly cell: number;
  readonly minX: number;
  readonly minZ: number;
  readonly columns: number;
  readonly rows: number;
  readonly open: Uint8Array;
  /** The region of each open cell, -1 for a closed one. */
  readonly region: Int32Array;
};

/** How far from a click to look for a reachable cell, in cells. */
const SEARCH_RINGS = 40;
const DIAGONAL = Math.SQRT2;
const STEPS: readonly (readonly [number, number, number])[] = [
  [1, 0, 1],
  [-1, 0, 1],
  [0, 1, 1],
  [0, -1, 1],
  [1, 1, DIAGONAL],
  [1, -1, DIAGONAL],
  [-1, 1, DIAGONAL],
  [-1, -1, DIAGONAL],
];

export function centreOf(grid: WalkGrid, index: number): MapPoint {
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  return [grid.minX + (column + 0.5) * grid.cell, grid.minZ + (row + 0.5) * grid.cell];
}

export function cellAt(grid: WalkGrid, [x, z]: MapPoint): number {
  const column = Math.floor((x - grid.minX) / grid.cell);
  const row = Math.floor((z - grid.minZ) / grid.cell);
  if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) return -1;
  return row * grid.columns + column;
}

function isOpen(grid: Pick<WalkGrid, "columns" | "rows" | "open">, column: number, row: number) {
  if (column < 0 || row < 0 || column >= grid.columns || row >= grid.rows) return false;
  return grid.open[row * grid.columns + column] === 1;
}

/** Each open neighbour, with the step's length; a diagonal only when both sides are open. */
export function eachNeighbour(
  grid: Pick<WalkGrid, "columns" | "rows" | "open">,
  index: number,
  visit: (next: number, length: number) => void,
) {
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  for (const [dc, dr, length] of STEPS) {
    if (!isOpen(grid, column + dc, row + dr)) continue;
    if (dc !== 0 && dr !== 0 && !(isOpen(grid, column + dc, row) && isOpen(grid, column, row + dr)))
      continue;
    visit((row + dr) * grid.columns + column + dc, length);
  }
}

function labelRegions(grid: Pick<WalkGrid, "columns" | "rows" | "open">): Int32Array {
  const region = new Int32Array(grid.open.length).fill(-1);
  const stack: number[] = [];
  let next = 0;
  for (let seed = 0; seed < grid.open.length; seed++) {
    if (grid.open[seed] !== 1 || region[seed] !== -1) continue;
    region[seed] = next;
    stack.push(seed);
    while (stack.length > 0) {
      const index = stack.pop() ?? 0;
      eachNeighbour(grid, index, (neighbour) => {
        if (region[neighbour] !== -1) return;
        region[neighbour] = next;
        stack.push(neighbour);
      });
    }
    next += 1;
  }
  return region;
}

export function buildGrid(
  open: (point: MapPoint) => boolean,
  bounds: Bounds,
  cell: number,
): WalkGrid {
  const columns = Math.floor((bounds.maxX - bounds.minX) / cell);
  const rows = Math.floor((bounds.maxZ - bounds.minZ) / cell);
  const flags = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) {
    const z = bounds.minZ + (row + 0.5) * cell;
    for (let column = 0; column < columns; column++) {
      flags[row * columns + column] = open([bounds.minX + (column + 0.5) * cell, z]) ? 1 : 0;
    }
  }
  const shape = { columns, rows, open: flags };
  return { cell, minX: bounds.minX, minZ: bounds.minZ, ...shape, region: labelRegions(shape) };
}

/** The cell nearest `point` that lies in `region` (any open cell when null), or -1 within reach. */
export function nearestCell(grid: WalkGrid, point: MapPoint, region: number | null): number {
  const column = Math.floor((point[0] - grid.minX) / grid.cell);
  const row = Math.floor((point[1] - grid.minZ) / grid.cell);
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let ring = 0; ring <= SEARCH_RINGS; ring++) {
    // A cell in the next ring can still be nearer than one found in this ring's corner.
    if (best !== -1 && (ring - 1) * grid.cell > bestDistance) break;
    for (let dr = -ring; dr <= ring; dr++) {
      for (let dc = -ring; dc <= ring; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== ring) continue;
        if (!isOpen(grid, column + dc, row + dr)) continue;
        const index = (row + dr) * grid.columns + column + dc;
        if (region !== null && grid.region[index] !== region) continue;
        const [x, z] = centreOf(grid, index);
        const distance = Math.hypot(x - point[0], z - point[1]);
        if (distance < bestDistance) {
          best = index;
          bestDistance = distance;
        }
      }
    }
  }
  return best;
}
