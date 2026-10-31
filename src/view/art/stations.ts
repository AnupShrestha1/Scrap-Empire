// Station art for Milestone 1, in the reference's style. Art pixels; see isoshapes.ts for the geometry.
import type { ItemId } from '../../data/items';
import type { ProcessorStatus } from '../../sim/events';
import { along, inDiamond, isoBox, isoDiamond, isoFrame, up, type Pt } from './isoshapes';
import { PALETTE as C } from './palette';
import { ART_SCALE, pixelArt, type Pixels } from './pixel';
import { seededRandom } from './random';
import { drawProductIcon } from './factory';

const SCRAP_COLOURS = [C.scrapDark, C.scrapGrey, C.rust, C.rust, C.rustLight, C.scrapGrey, C.scrapBlue];

/** Random 2×2 chunks of scrap wherever `inside` allows, for heaps on piles and trucks. */
function scrapChunks(p: Pixels, rand: () => number, x0: number, y0: number, w: number, h: number, count: number, inside: (x: number, y: number) => boolean): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(x0 + rand() * w);
    const y = Math.floor(y0 + rand() * h);
    if (!inside(x, y)) continue;
    const colour = SCRAP_COLOURS[Math.floor(rand() * SCRAP_COLOURS.length)]!;
    p.rect(x, y, 2 + Math.floor(rand() * 2), 2, colour);
  }
}

// ---------- Shredder (2×2) ----------

export const SHREDDER_FRAME = isoFrame(2, 2, 32);
const BODY_H = 20;

/** The shredder; `frame` 0/1 alternate while it works. */
export function drawShredder(frame: number) {
  return pixelArt((p) => {
    const g = SHREDDER_FRAME.ground;
    isoBox(p, g, 2, 2, BODY_H, { top: C.steelTop, left: C.steelLeft, right: C.steelRight });
    // Safety-yellow band with hazard stripes around the top of the body.
    isoBox(p, g, 2, 2, BODY_H, { top: C.steelTop, left: C.safety, right: C.safetyDark }, BODY_H - 5);
    hazardStripes(p, g);
    // Vents on the front-left face, shifted between frames so it looks like it's running.
    for (let i = 0; i < 4; i++) {
      const a = 0.35 + i * 0.4 + (frame ? 0.1 : 0);
      const base = along(g, a, 2);
      p.rect(base[0], base[1] - 12, 2, 5, C.hole);
    }
    // Output chute on the front-right face.
    const c0 = along(g, 2, 0.6);
    const c1 = along(g, 2, 1.4);
    p.polygon([up(c0, 11), up(c1, 11), up(c1, 3), up(c0, 3)], C.hole);
    // Hopper on top, with an opening and scrap inside while working.
    const hg = along(g, 0.5, 0.5);
    isoBox(p, hg, 1, 1, BODY_H + 8, { top: C.safety, left: C.safety, right: C.safetyDark }, BODY_H);
    isoDiamond(p, along(hg, 0.25, 0.25), 0.5, 0.5, BODY_H + 8, C.hole);
    if (frame) {
      const [hx, hy] = up(along(hg, 0.5, 0.5), BODY_H + 8);
      p.rect(hx - 2, hy - 1, 2, 1, C.rustLight);
      p.rect(hx + 1, hy, 2, 1, C.scrapGrey);
    }
  });
}

function hazardStripes(p: Pixels, g: Pt): void {
  const left = along(g, 0, 2);
  const bottom = along(g, 2, 2);
  for (let x = left[0]; x < bottom[0]; x++) {
    if ((x - left[0]) % 6 >= 2) continue;
    const y = left[1] + Math.floor((x - left[0]) / 2) - BODY_H;
    p.rect(x, y + 1, 1, 3, C.outline);
  }
}

/**
 * Where the status lamp floats, in render pixels from the shredder's ground anchor (its bottom corner):
 * the footprint centre is 16 art px above that corner, the hopper top 28 above the centre.
 */
export const SHREDDER_LAMP_OFFSET = { x: 0, y: -(16 + BODY_H + 8 + 8) * ART_SCALE } as const;

const LAMP_COLOUR: Record<ProcessorStatus, string> = {
  idle: C.lampOff,
  processing: C.lampGreen,
  ready: C.lampYellow,
  blocked: C.lampRed,
};

export const LAMP_FRAME = { w: 16, h: 16 } as const;
export function drawLamp(status: ProcessorStatus) {
  return pixelArt((p) => {
    p.ellipse(4, 4, 3, 3, LAMP_COLOUR[status]);
    p.px(3, 3, '#ffffff');
  });
}

// ---------- Material bins (2×2) ----------

export const BIN_FRAME = isoFrame(2, 2, 18);
export const BIN_LEVELS = 5;
const WALL_H = 16;

export type BinItem = 'iron' | 'aluminium' | 'copper';

const BIN_COLOURS: Record<BinItem, { wall: string; wallDark: string; rim: string; fill: string; fillDark: string }> = {
  iron: { wall: '#5f6f86', wallDark: '#4a586c', rim: '#7d8ca3', fill: C.iron, fillDark: C.ironDark },
  aluminium: { wall: '#8fa3b3', wallDark: '#71838f', rim: '#a9bccb', fill: C.aluminium, fillDark: C.aluminiumDark },
  copper: { wall: '#b5602a', wallDark: '#8a4620', rim: '#d27b3d', fill: C.copper, fillDark: C.copperDark },
};

/** An open container; `level` 0..BIN_LEVELS-1 is how full it looks. */
export function drawBin(item: BinItem, level: number) {
  return pixelArt((p) => {
    const g = BIN_FRAME.ground;
    const k = BIN_COLOURS[item];
    const faces = { top: k.rim, left: k.wall, right: k.wallDark };
    isoBox(p, g, 2, 2, WALL_H, faces);
    const inner = along(g, 0.25, 0.25);
    isoDiamond(p, inner, 1.5, 1.5, WALL_H, C.hole);
    if (level > 0) {
      // Contents sit high enough to read at a glance; full heaps just above the rim.
      const h = [0, 9, 12, 15, 17][level]!;
      isoDiamond(p, inner, 1.5, 1.5, h, k.fill);
      const rand = seededRandom(57 + level);
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(p.w * rand());
        const y = Math.floor(p.h * rand());
        if (inDiamond(x, y, inner, 1.5, 1.5, h) && inDiamond(x, y, inner, 1.5, 1.5, WALL_H)) p.rect(x, y, 2, 1, k.fillDark);
      }
    }
    // Redraw the front walls over anything that spilled below the rim, then add ribs.
    const f = { left: along(g, 0, 2), bottom: along(g, 2, 2), right: along(g, 2, 0) };
    p.polygon([up(f.left, WALL_H), up(f.bottom, WALL_H), f.bottom, f.left], k.wall);
    p.polygon([up(f.bottom, WALL_H), up(f.right, WALL_H), f.right, f.bottom], k.wallDark);
    for (let i = 1; i < 5; i++) {
      for (const [from, to, rib] of [[f.left, f.bottom, k.wallDark], [f.bottom, f.right, k.rim]] as const) {
        const x = Math.round(from[0] + ((to[0] - from[0]) * i) / 5);
        const y = Math.round(from[1] + ((to[1] - from[1]) * i) / 5);
        p.rect(x, y - WALL_H + 2, 1, WALL_H - 3, rib);
      }
    }
    // Material badge on the front-left face.
    const badge = along(g, 1, 2);
    p.rect(badge[0] - 4, badge[1] - 11, 6, 4, k.fill);
  });
}

// ---------- Supplier truck (3 × 1, cab towards +x) ----------

export const TRUCK_FRAME = isoFrame(3, 1, 26);

export function drawTruck(loaded: boolean) {
  return pixelArt((p) => {
    const g = TRUCK_FRAME.ground;
    // Wheels first, so the body covers their tops.
    for (const a of [0.5, 2.5]) {
      const [wx, wy] = along(g, a, 1);
      p.ellipse(wx, wy - 2, 3.5, 3, C.tyre);
    }
    isoBox(p, g, 2, 1, 12, { top: C.bedTop, left: C.bedLeft, right: C.bedRight }, 3);
    if (loaded) {
      const rand = seededRandom(71);
      // A heap a few pixels above the bed floor.
      scrapChunks(p, rand, 0, 0, p.w, p.h, 260, (x, y) => inDiamond(x, y, g, 2, 1, 15));
    }
    const cab = along(g, 2, 0);
    isoBox(p, cab, 1, 1, 24, { top: C.truckBlueLight, left: C.truckBlue, right: C.truckBlueDark }, 3);
    // Windscreen (front, +x face) and side window.
    const w0 = along(cab, 1, 0.15);
    const w1 = along(cab, 1, 0.85);
    p.polygon([up(w0, 21), up(w1, 21), up(w1, 14), up(w0, 14)], C.glass);
    const s0 = along(cab, 0.15, 1);
    const s1 = along(cab, 0.7, 1);
    p.polygon([up(s0, 21), up(s1, 21), up(s1, 14), up(s0, 14)], C.glass);
    // Bumper.
    const b0 = along(cab, 1, 0);
    const b1 = along(cab, 1, 1);
    p.polygon([up(b0, 6), up(b1, 6), up(b1, 3), up(b0, 3)], C.scrapGrey);
  });
}

// ---------- Item icons (carried stack, trays) ----------

export const ITEM_FRAME = isoFrame(0.5, 0.25, 4);

const INGOT: Partial<Record<ItemId, { top: string; side: string }>> = {
  iron: { top: C.iron, side: C.ironDark },
  aluminium: { top: C.aluminium, side: C.aluminiumDark },
  copper: { top: C.copper, side: C.copperDark },
};

export function drawItem(item: ItemId) {
  return pixelArt((p) => {
    const g = ITEM_FRAME.ground;
    if (item === 'sheet' || item === 'can') {
      drawProductIcon(p, g, item);
      return;
    }
    const ingot = INGOT[item];
    if (ingot) {
      isoBox(p, g, 0.5, 0.25, 3, { top: ingot.top, left: ingot.side, right: ingot.side });
      return;
    }
    // Scrap: a jagged lump.
    const [cx, cy] = along(g, 0.25, 0.125);
    p.ellipse(cx, cy - 1, 5, 3, C.scrapDark);
    p.rect(cx - 4, cy - 2, 3, 2, C.rust);
    p.rect(cx, cy - 3, 3, 2, C.scrapGrey);
    p.rect(cx + 1, cy - 1, 2, 1, C.rustLight);
  });
}

// ---------- Interaction pads (where the player stands) ----------

export type PadKind = 'pickup' | 'dropoff' | 'sell' | 'buy';

const PAD_COLOUR: Record<PadKind, { edge: string; fill: string }> = {
  pickup: { edge: C.lampGreen, fill: 'rgba(92, 200, 74, 0.22)' },
  dropoff: { edge: '#ff9a3c', fill: 'rgba(255, 154, 60, 0.22)' },
  sell: { edge: C.lampYellow, fill: 'rgba(245, 197, 66, 0.3)' },
  buy: { edge: C.truckBlueLight, fill: 'rgba(79, 143, 230, 0.3)' },
};

export function padFrame(a: number, b: number) {
  return isoFrame(a, b, 0);
}

/** A painted floor marking `a`×`b` tiles: a bright border with a faint fill. */
export function drawPad(a: number, b: number, kind: PadKind) {
  return pixelArt(
    (p) => {
      const g = padFrame(a, b).ground;
      const corners = (from: Pt, w: number, h: number): Pt[] => [from, along(from, w, 0), along(from, w, h), along(from, 0, h)];
      const outer = corners(along(g, 0.125, 0.125), a - 0.25, b - 0.25);
      const inner = corners(along(g, 0.25, 0.25), a - 0.5, b - 0.5);
      p.polygon(outer, PAD_COLOUR[kind].edge);
      p.cutPolygon(inner);
      p.polygon(inner, PAD_COLOUR[kind].fill);
      if (kind === 'buy') {
        // An upward chevron: "upgrade".
        const [cx, cy] = along(g, a / 2, b / 2);
        for (let i = 0; i < 4; i++) {
          p.rect(cx - 4 + i, cy - 1 - i, 2, 2, C.truckBlueLight);
          p.rect(cx + 3 - i, cy - 1 - i, 2, 2, C.truckBlueLight);
        }
      }
      if (kind === 'sell') {
        // A gold coin in the middle of the pad.
        const [cx, cy] = along(g, a / 2, b / 2);
        p.ellipse(cx, cy, 5, 3, C.safetyDark);
        p.ellipse(cx, cy - 1, 5, 3, C.lampYellow);
        p.rect(cx - 1, cy - 3, 2, 3, C.safetyDark);
      }
    },
    { outline: false },
  );
}

// ---------- Hint arrow ----------

export const ARROW_FRAME = { w: 32, h: 40 } as const;

/** A bold downward arrow that bobs above the next objective's spot. */
export const drawArrow = pixelArt((p) => {
  p.rect(5, 1, 6, 9, C.lampYellow);
  p.polygon([[1, 10], [15, 10], [8, 18]], C.lampYellow);
  p.rect(6, 2, 2, 7, '#fff3b0');
});
