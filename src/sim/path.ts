// Grid pathfinding for employees: A* over tiles, 8 directions without cutting corners. A tile is walkable
// when nothing solid is in it (fences, machines, bins, trees and water all block).
import type { Grid } from './grid';
import type { Rect } from './stations';
import type { Vec2 } from './vec';

export function walkable(grid: Grid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return false;
  return grid.solids[ty * grid.width + tx] === undefined;
}

/** The walkable tile of `rect` closest to `from`, as its centre point; undefined if none is walkable. */
export function nearestWalkableIn(grid: Grid, rect: Rect, from: Vec2): Vec2 | undefined {
  let best: Vec2 | undefined;
  let bestD = Infinity;
  for (let y = rect.y; y < rect.y + rect.h; y++) {
    for (let x = rect.x; x < rect.x + rect.w; x++) {
      if (!walkable(grid, x, y)) continue;
      const d = Math.hypot(x + 0.5 - from.x, y + 0.5 - from.y);
      if (d < bestD) {
        bestD = d;
        best = { x: x + 0.5, y: y + 0.5 };
      }
    }
  }
  return best;
}

const DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * Waypoints from `from` to `to`: tile centres along the way, then `to` itself. Returns undefined when no
 * route exists. Starting inside a blocked tile is allowed (the first step leaves it).
 */
export function findPath(grid: Grid, from: Vec2, to: Vec2): Vec2[] | undefined {
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const gx = Math.floor(to.x);
  const gy = Math.floor(to.y);
  if (sx === gx && sy === gy) return [{ x: to.x, y: to.y }];
  if (!walkable(grid, gx, gy)) return undefined;

  const w = grid.width;
  const key = (x: number, y: number) => y * w + x;
  const g = new Map<number, number>([[key(sx, sy), 0]]);
  const came = new Map<number, number>();
  const open: number[] = [key(sx, sy)];
  const f = new Map<number, number>([[key(sx, sy), Math.hypot(gx - sx, gy - sy)]]);
  const closed = new Set<number>();

  while (open.length > 0) {
    // Small grids and short routes: a linear scan for the best open node is fast enough.
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (f.get(open[i]!)! < f.get(open[bi]!)!) bi = i;
    const current = open.splice(bi, 1)[0]!;
    const cx = current % w;
    const cy = Math.floor(current / w);
    if (cx === gx && cy === gy) break;
    closed.add(current);

    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!walkable(grid, nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (!walkable(grid, cx + dx, cy) || !walkable(grid, cx, cy + dy))) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      const cost = g.get(current)! + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (cost >= (g.get(nk) ?? Infinity)) continue;
      came.set(nk, current);
      g.set(nk, cost);
      f.set(nk, cost + Math.hypot(gx - nx, gy - ny));
      if (!open.includes(nk)) open.push(nk);
    }
  }

  const goal = key(gx, gy);
  if (!came.has(goal)) return undefined;
  const points: Vec2[] = [{ x: to.x, y: to.y }];
  let at = came.get(goal)!;
  while (at !== key(sx, sy)) {
    points.unshift({ x: (at % w) + 0.5, y: Math.floor(at / w) + 0.5 });
    at = came.get(at)!;
  }
  return points;
}
