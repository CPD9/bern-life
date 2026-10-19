// Click-to-walk: A* over the walk grid from the walker to the reachable cell nearest the click,
// then the path pulled straight wherever the grid sees through, so you walk lines, not stairs.

import { type MapPoint } from "./geography";
import { cellAt, centreOf, eachNeighbour, nearestCell, type WalkGrid } from "./walk-grid";

/** A binary heap of cell indices, cheapest first by `cost`. */
function heap(cost: Float64Array) {
  const items: number[] = [];
  const less = (a: number, b: number) => (cost[items[a] ?? 0] ?? 0) < (cost[items[b] ?? 0] ?? 0);
  const swap = (a: number, b: number) => {
    const held = items[a] ?? 0;
    items[a] = items[b] ?? 0;
    items[b] = held;
  };
  return {
    size: () => items.length,
    push(index: number) {
      items.push(index);
      for (let at = items.length - 1; at > 0 && less(at, (at - 1) >> 1); at = (at - 1) >> 1) {
        swap(at, (at - 1) >> 1);
      }
    },
    pop(): number {
      const top = items[0] ?? -1;
      const last = items.pop() ?? -1;
      if (items.length === 0) return top;
      items[0] = last;
      for (let at = 0; ; ) {
        const left = 2 * at + 1;
        const smaller =
          left + 1 < items.length && less(left + 1, left) ? left + 1 : left < items.length ? left : -1;
        if (smaller === -1 || !less(smaller, at)) break;
        swap(at, smaller);
        at = smaller;
      }
      return top;
    },
  };
}

/** Octile distance: exact on an open 8-neighbour grid, so A* stays optimal. */
function estimate(grid: WalkGrid, from: number, to: number): number {
  const dx = Math.abs((from % grid.columns) - (to % grid.columns));
  const dz = Math.abs(Math.floor(from / grid.columns) - Math.floor(to / grid.columns));
  return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
}

function search(grid: WalkGrid, start: number, goal: number): number[] {
  const travelled = new Float64Array(grid.open.length).fill(Number.POSITIVE_INFINITY);
  const ranked = new Float64Array(grid.open.length);
  const cameFrom = new Int32Array(grid.open.length).fill(-1);
  const queue = heap(ranked);
  travelled[start] = 0;
  ranked[start] = estimate(grid, start, goal);
  queue.push(start);
  while (queue.size() > 0) {
    const index = queue.pop();
    if (index === goal) break;
    const here = travelled[index] ?? 0;
    eachNeighbour(grid, index, (next, length) => {
      if (here + length >= (travelled[next] ?? 0)) return;
      travelled[next] = here + length;
      ranked[next] = here + length + estimate(grid, next, goal);
      cameFrom[next] = index;
      queue.push(next);
    });
  }
  const cells = [goal];
  for (let at = goal; at !== start; ) {
    at = cameFrom[at] ?? start;
    cells.push(at);
  }
  return cells.reverse();
}

/** True when every grid cell under the line from `a` to `b` is open. */
export function seesThrough(grid: WalkGrid, a: MapPoint, b: MapPoint): boolean {
  const samples = Math.ceil((Math.hypot(b[0] - a[0], b[1] - a[1]) / grid.cell) * 3);
  for (let sample = 0; sample <= samples; sample++) {
    const t = samples === 0 ? 0 : sample / samples;
    const index = cellAt(grid, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    if (index === -1 || grid.open[index] !== 1) return false;
  }
  return true;
}

/** Keeps a point only where the line from the last kept point to the one after it is blocked. */
export function pullStraight(grid: WalkGrid, points: readonly MapPoint[]): MapPoint[] {
  const first = points[0];
  if (first === undefined) return [];
  const kept: MapPoint[] = [first];
  let anchor = 0;
  while (anchor < points.length - 1) {
    let reach = anchor + 1;
    const from = points[anchor] ?? first;
    while (reach + 1 < points.length && seesThrough(grid, from, points[reach + 1] ?? from)) {
      reach += 1;
    }
    kept.push(points[reach] ?? from);
    anchor = reach;
  }
  return kept;
}

/**
 * The points to walk through from `from` toward `to`, not counting where the walker stands: the
 * clicked spot itself when it can be reached, else the reachable spot nearest it. Null when the
 * walker stands nowhere on the grid's open cells.
 */
export function findPath(grid: WalkGrid, from: MapPoint, to: MapPoint): MapPoint[] | null {
  const start = nearestCell(grid, from, null);
  if (start === -1) return null;
  const goal = nearestCell(grid, to, grid.region[start] ?? null);
  if (goal === -1) return null;
  const end = cellAt(grid, to) === goal ? to : centreOf(grid, goal);
  const route = [from, ...search(grid, start, goal).map((cell) => centreOf(grid, cell)), end];
  return pullStraight(grid, route).slice(1);
}
