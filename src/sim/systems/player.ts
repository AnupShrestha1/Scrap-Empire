import { PLAYER } from '../../data/player';
import { forEachSolid, type Grid } from '../grid';
import type { PlayerState } from '../state';
import type { Vec2 } from '../vec';

/** Keeps the player a hair away from obstacles so the next overlap test doesn't see them as touching. */
const EPSILON = 1e-4;

/**
 * Moves the player for one tick of `dt` seconds. `move` has length 0..1 (longer is normalised).
 * Returns true if the position changed.
 */
export function stepPlayer(player: PlayerState, move: Vec2, grid: Grid, dt: number): boolean {
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
  player.x = moveAxis(grid, player.x, player.y, mx * step, true);
  player.y = moveAxis(grid, player.x, player.y, my * step, false);
  player.facing = Math.abs(mx) >= Math.abs(my) ? (mx > 0 ? 'right' : 'left') : my > 0 ? 'down' : 'up';
  return player.x !== startX || player.y !== startY;
}

/** Moves along one axis and stops flush against the nearest obstacle in the way. */
function moveAxis(grid: Grid, x: number, y: number, delta: number, horizontal: boolean): number {
  const pos = horizontal ? x : y;
  if (delta === 0) return pos;

  const r = PLAYER.halfSize;
  const next = pos + delta;
  let limit = next;
  const clamp = (lo: number, hi: number) => {
    limit = delta > 0 ? Math.min(limit, lo - r - EPSILON) : Math.max(limit, hi + r + EPSILON);
  };
  if (horizontal) forEachSolid(grid, next - r, y - r, next + r, y + r, (x0, _y0, x1) => clamp(x0, x1));
  else forEachSolid(grid, x - r, next - r, x + r, next + r, (_x0, y0, _x1, y1) => clamp(y0, y1));

  // Never get pushed backwards (only possible if already touching something).
  return delta > 0 ? Math.max(pos, limit) : Math.min(pos, limit);
}
