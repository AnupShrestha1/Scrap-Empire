// Isometric building blocks in art pixels. One grid step along x is (+16, +8); along y is (−16, +8).
import { ART_SCALE, type Pixels } from './pixel';

export type Pt = readonly [number, number];

const STEP_X: Pt = [16, 8];
const STEP_Y: Pt = [-16, 8];

/** Ground point `a` tiles along x and `b` along y from `from`. */
export function along(from: Pt, a: number, b: number): Pt {
  return [from[0] + STEP_X[0] * a + STEP_Y[0] * b, from[1] + STEP_X[1] * a + STEP_Y[1] * b];
}

export function up(p: Pt, h: number): Pt {
  return [p[0], p[1] - h];
}

export interface BoxColors {
  top: string;
  /** The face along the box's +y edge (front-left on screen, lit). */
  left: string;
  /** The face along the box's +x edge (front-right on screen, shaded). */
  right: string;
}

/** Corners of a box footprint whose top (back) corner is at ground point `g`. */
export function footprint(g: Pt, a: number, b: number): { top: Pt; right: Pt; bottom: Pt; left: Pt } {
  return { top: g, right: along(g, a, 0), bottom: along(g, a, b), left: along(g, 0, b) };
}

/**
 * Draws a box `a`×`b` tiles whose back corner is above ground point `g`, spanning heights `base`
 * to `h` art pixels (base 0 stands on the ground).
 */
export function isoBox(p: Pixels, g: Pt, a: number, b: number, h: number, c: BoxColors, base = 0): void {
  const f = footprint(g, a, b);
  p.polygon([up(f.left, h), up(f.bottom, h), up(f.bottom, base), up(f.left, base)], c.left);
  p.polygon([up(f.bottom, h), up(f.right, h), up(f.right, base), up(f.bottom, base)], c.right);
  p.polygon([up(f.top, h), up(f.right, h), up(f.bottom, h), up(f.left, h)], c.top);
}

/** True if (x, y) lies inside the diamond `a`×`b` at ground point `g` raised by `h`. */
export function inDiamond(x: number, y: number, g: Pt, a: number, b: number, h: number): boolean {
  // Convert back to grid offsets: u along x, v along y.
  const dx = x - g[0];
  const dy = y - (g[1] - h);
  const u = (dx / 16 + dy / 8) / 2;
  const v = (dy / 8 - dx / 16) / 2;
  return u >= 0 && v >= 0 && u <= a && v <= b;
}

/** A flat diamond `a`×`b` tiles at ground point `g`, raised by `h`. */
export function isoDiamond(p: Pixels, g: Pt, a: number, b: number, h: number, color: string): void {
  const f = footprint(g, a, b);
  p.polygon([up(f.top, h), up(f.right, h), up(f.bottom, h), up(f.left, h)], color);
}

/**
 * Frame layout for something with an `a`×`b` footprint rising `height` art pixels above the ground.
 * Returns the frame size in render pixels, the ground back-corner point to draw from (art pixels),
 * and the origin (0..1) of the footprint's bottom corner, which is anchored to the ground.
 */
export function isoFrame(a: number, b: number, height: number) {
  // One art pixel of margin all round, so the outline pass has room.
  const pad = 1;
  const wArt = (a + b) * 16 + pad * 2;
  const hArt = (a + b) * 8 + height + pad * 2;
  return {
    w: wArt * ART_SCALE,
    h: hArt * ART_SCALE,
    ground: [b * 16 + pad, height + pad] as Pt,
    originX: (a * 16 + pad) / wArt,
    originY: (hArt - pad) / hArt,
  };
}
