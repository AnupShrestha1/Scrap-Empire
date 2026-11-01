import { PLAYER } from '../../data/player';
import { forEachSolid, type Grid } from '../grid';
import type { PlayerState } from '../state';
import type { Rect } from '../stations';
import type { Vec2 } from '../vec';

/** Keeps the player a hair away from obstacles so the next overlap test doesn't see them as touching. */
const EPSILON = 1e-4;

/**
 * Moves the player for one tick of `dt` seconds. `move` has length 0..1 (longer is normalised).
 * `blockers` are moving obstacles (trucks); one the player already overlaps doesn't block, so a truck
 * pulling in over them can't trap them. Returns true if the position changed.
 */
export function stepPlayer(player: PlayerState, move: Vec2, grid: Grid, dt: number, blockers: readonly Rect[] = []): boolean {
  let mx = move.x;
  let my = move.y;
  const len = Math.hypot(mx, my);
  if (len < 1e-3) return false;
  if (len > 1) {
    mx /= len;
    my /= len;
  }

  const startX = player.x;
  const startY = player.y;
  const step = PLAYER.speed * dt;
  // One axis at a time, so pushing diagonally into a wall slides along it.
  const r = PLAYER.halfSize;
  const solid = blockers.filter((b) => !(b.x < player.x + r && b.x + b.w > player.x - r && b.y < player.y + r && b.y + b.h > player.y - r));
  player.x = moveAxis(grid, solid, player.x, player.y, mx * step, true);
  player.y = moveAxis(grid, solid, player.x, player.y, my * step, false);
  player.facing = Math.abs(mx) >= Math.abs(my) ? (mx > 0 ? 'right' : 'left') : my > 0 ? 'down' : 'up';
  return player.x !== startX || player.y !== startY;
}

/** Moves along one axis and stops flush against the nearest obstacle in the way. */
function moveAxis(grid: Grid, blockers: readonly Rect[], x: number, y: number, delta: number, horizontal: boolean): number {
  const pos = horizontal ? x : y;
  if (delta === 0) return pos;

  const r = PLAYER.halfSize;
  const next = pos + delta;
  let limit = next;
  const clamp = (lo: number, hi: number) => {
    limit = delta > 0 ? Math.min(limit, lo - r - EPSILON) : Math.max(limit, hi + r + EPSILON);
  };
  const [minX, minY, maxX, maxY] = horizontal ? [next - r, y - r, next + r, y + r] : [x - r, next - r, x + r, next + r];
  const hit = (x0: number, y0: number, x1: number, y1: number) => (horizontal ? clamp(x0, x1) : clamp(y0, y1));
  forEachSolid(grid, minX, minY, maxX, maxY, hit);
  for (const b of blockers) {
    if (b.x < maxX && b.x + b.w > minX && b.y < maxY && b.y + b.h > minY) hit(b.x, b.y, b.x + b.w, b.y + b.h);
  }

  // Never get pushed backwards (only possible if already touching something).
  return delta > 0 ? Math.max(pos, limit) : Math.min(pos, limit);
}
