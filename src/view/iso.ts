// Isometric (2:1 diamond) projection between the simulation's square grid and the screen.
// The simulation never sees this: it works in tiles; only the view projects.
import { VIEW } from '../config';
import type { Vec2 } from '../sim/vec';

const HALF_W = VIEW.tileW / 2;
const HALF_H = VIEW.tileH / 2;

/** Where a grid of the given size lands on screen. Grid (0, 0) is the top corner. */
export interface IsoProjection {
  /** Screen x of the grid's top corner, so the leftmost corner sits at x = 0. */
  readonly originX: number;
  /** Bounding box of the whole diamond-shaped grid. */
  readonly width: number;
  readonly height: number;
}

export function isoProjection(gridW: number, gridH: number): IsoProjection {
  return { originX: gridH * HALF_W, width: (gridW + gridH) * HALF_W, height: (gridW + gridH) * HALF_H };
}

/** Screen position of a grid point (tile units; tile (x, y) has its top corner at grid point (x, y)). */
export function toScreen(proj: IsoProjection, gx: number, gy: number, out: Vec2 = { x: 0, y: 0 }): Vec2 {
  out.x = (gx - gy) * HALF_W + proj.originX;
  out.y = (gx + gy) * HALF_H;
  return out;
}

/** Draw order for something standing at grid point (gx, gy): further down the screen draws in front. */
export function depthAt(gx: number, gy: number): number {
  return (gx + gy) * HALF_H;
}

/**
 * Turns a screen-space input direction (joystick or keys; "up" means up the screen) into a grid
 * direction with the same strength, so the worker walks where the player points.
 */
export function screenDirToGrid(sx: number, sy: number, out: Vec2): Vec2 {
  const strength = Math.min(1, Math.hypot(sx, sy));
  if (strength === 0) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const gx = sx / VIEW.tileW + sy / VIEW.tileH;
  const gy = sy / VIEW.tileH - sx / VIEW.tileW;
  const len = Math.hypot(gx, gy);
  out.x = (gx / len) * strength;
  out.y = (gy / len) * strength;
  return out;
}
