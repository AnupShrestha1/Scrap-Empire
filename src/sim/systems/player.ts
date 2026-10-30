import { PLAYER } from '../../data/player';
import { boxHitsSolid, type Grid } from '../grid';
import type { PlayerState } from '../state';
import type { Vec2 } from '../vec';

/** Keeps the player a hair away from walls so the next overlap test doesn't see them as touching. */
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

/** Moves along one axis and stops flush against the first solid tile. Steps must be under one tile. */
function moveAxis(grid: Grid, x: number, y: number, delta: number, horizontal: boolean): number {
  const pos = horizontal ? x : y;
  if (delta === 0) return pos;

  const r = PLAYER.halfSize;
  const next = pos + delta;
  const hit = horizontal
    ? boxHitsSolid(grid, next - r, y - r, next + r, y + r)
    : boxHitsSolid(grid, x - r, next - r, x + r, next + r);
  if (!hit) return next;

  // The blocking tile is the one the leading edge just entered.
  return delta > 0 ? Math.ceil(next + r) - 1 - r - EPSILON : Math.floor(next - r) + 1 + r + EPSILON;
}
