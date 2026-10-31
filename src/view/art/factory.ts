// Manufacturing art: the factory building from the reference (red roof, brick, blue windows),
// and product icons. Art pixels.
import { along, footprint, isoBox, isoFrame, up, type Pt } from './isoshapes';
import { PALETTE as C } from './palette';
import { pixelArt, type Pixels } from './pixel';

const STEEL = { top: C.steelTop, left: C.steelLeft, right: C.steelRight };
const SHEET = { top: '#c9d1da', left: '#9aa4b0', right: '#7d8794' };
const BRICK = '#b5563a';
const BRICK_DARK = '#8f4330';
const MORTAR = '#d9a184';
const ROOF = '#d8443a';
const ROOF_DARK = '#a92f2a';

/** A small upright can at (x, y) (its base), red with a silver lid. */
function can(p: Pixels, x: number, y: number): void {
  p.rect(x - 2, y - 5, 5, 5, C.shirt);
  p.rect(x + 1, y - 5, 2, 5, C.shirtDark);
  p.rect(x - 2, y - 3, 5, 1, C.aluminium);
  p.rect(x - 2, y - 6, 5, 1, C.aluminium);
}

// ---------- Factory (4 × 6) ----------

export const FACTORY_SIZE = { a: 4, b: 6 } as const;
const WALL_H = 26;
export const FACTORY_FRAME = isoFrame(FACTORY_SIZE.a, FACTORY_SIZE.b, 46);
/** Production line windows along the front-left (+y) wall, one per line slot. */
export const FACTORY_WINDOWS = 4;

/** Height in art pixels at which a line's lamp sits above its window. */
export const LINE_LAMP_HEIGHT = WALL_H + 4;

export const drawFactory = pixelArt((p) => {
  const g = FACTORY_FRAME.ground;
  const { a, b } = FACTORY_SIZE;
  isoBox(p, g, a, b, WALL_H, { top: ROOF, left: BRICK, right: BRICK_DARK });

  // Brick courses on both front walls.
  const f = footprint(g, a, b);
  for (const [from, to] of [[f.left, f.bottom], [f.bottom, f.right]] as const) {
    const dx = Math.sign(to[0] - from[0]);
    for (let x = from[0]; x !== to[0]; x += dx) {
      const t = (x - from[0]) / (to[0] - from[0]);
      const base = Math.round(from[1] + (to[1] - from[1]) * t);
      for (let h = 4; h < WALL_H - 2; h += 4) {
        if ((x + h) % 8 < 6) p.px(x, base - h, MORTAR);
      }
    }
  }

  // Roof panels and a ridge, so the top reads as a roof rather than a slab.
  for (let i = 1; i < b; i++) {
    const s = up(along(g, 0, i), WALL_H);
    const e = up(along(g, a, i), WALL_H);
    for (let t = 0; t <= 64; t++) {
      p.px(Math.round(s[0] + ((e[0] - s[0]) * t) / 64), Math.round(s[1] + ((e[1] - s[1]) * t) / 64), ROOF_DARK);
    }
  }

  // One window per line slot on the front-left wall.
  for (let i = 0; i < FACTORY_WINDOWS; i++) {
    const w0 = along(g, 0.25 + i, b);
    const w1 = along(g, 0.75 + i, b);
    p.polygon([up(w0, 20), up(w1, 20), up(w1, 9), up(w0, 9)], '#2a3a52');
    p.polygon([up(w0, 19), up(w1, 19), up(w1, 10), up(w0, 10)], C.glass);
    const [mx, my] = up(along(g, 0.5 + i, b), 19);
    p.rect(mx, my, 1, 9, '#2a3a52');
  }

  // A roll-up loading door on the front-right wall.
  const d0 = along(g, a, 2);
  const d1 = along(g, a, 4);
  p.polygon([up(d0, 17), up(d1, 17), d1, d0], C.scrapGrey);
  for (let h = 2; h < 17; h += 3) {
    const s = up(d0, h);
    const e = up(d1, h);
    for (let t = 0; t <= 32; t++) {
      p.px(Math.round(s[0] + ((e[0] - s[0]) * t) / 32), Math.round(s[1] + ((e[1] - s[1]) * t) / 32), C.steelRight);
    }
  }

  // Chimney at the back corner, with a red band.
  const ch = along(g, 0.5, 0.75);
  isoBox(p, ch, 0.75, 0.75, 46, STEEL, WALL_H);
  isoBox(p, ch, 0.75, 0.75, 42, { top: ROOF, left: ROOF, right: ROOF_DARK }, 39);
});

/** Where line `i`'s lamp sits, as a grid point on the factory's front-left wall. */
export function lineWindowPoint(rect: { x: number; y: number; h: number }, i: number): Pt {
  return [rect.x + 0.5 + i, rect.y + rect.h];
}

// ---------- Product icons ----------

/** Draws a product icon in an item frame whose ground point is `g`. */
export function drawProductIcon(p: Pixels, g: Pt, item: 'sheet' | 'can'): void {
  if (item === 'sheet') {
    isoBox(p, g, 0.5, 0.25, 2, SHEET);
    return;
  }
  const [x, y] = along(g, 0.25, 0.125);
  can(p, x, y + 1);
}

