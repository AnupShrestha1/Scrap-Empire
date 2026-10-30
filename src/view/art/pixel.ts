import { PALETTE } from './palette';
import type { Draw } from './textures';

/** Render pixels per art pixel. Art is drawn at 32 px per tile and shown at 64. */
export const ART_SCALE = 2;

/** Pixels at or above this alpha count as solid for outlining; shadows stay below it. */
const SOLID_ALPHA = 200;

/** Integer-only drawing on a small canvas, so every shape stays crisp pixel art. */
export class Pixels {
  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    readonly w: number,
    readonly h: number,
  ) {}

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  px(x: number, y: number, color: string): void {
    this.rect(x, y, 1, 1, color);
  }

  /** Filled ellipse built from one-pixel rows, so it has no anti-aliased edge. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    for (let row = Math.floor(cy - ry); row < Math.ceil(cy + ry); row++) {
      const dy = row + 0.5 - cy;
      if (Math.abs(dy) > ry) continue;
      const half = rx * Math.sqrt(1 - (dy / ry) ** 2);
      const x0 = Math.round(cx - half);
      const x1 = Math.round(cx + half);
      if (x1 > x0) this.rect(x0, row, x1 - x0, 1, color);
    }
  }
}

export type PixelDraw = (p: Pixels) => void;

/**
 * Wraps a pixel drawing as a full-size Draw: paints at 1/ART_SCALE resolution, optionally adds a
 * one-pixel outline around solid shapes, then scales up with nearest-neighbour.
 */
export function pixelArt(draw: PixelDraw, { outline = true } = {}): Draw {
  return (ctx, w, h) => {
    const aw = Math.round(w / ART_SCALE);
    const ah = Math.round(h / ART_SCALE);
    const small = document.createElement('canvas');
    small.width = aw;
    small.height = ah;
    const sctx = small.getContext('2d');
    if (!sctx) throw new Error('Canvas 2D is not available');
    draw(new Pixels(sctx, aw, ah));
    if (outline) addOutline(sctx, aw, ah);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, aw, ah, 0, 0, w, h);
  };
}

/** Paints the outline colour on every non-solid pixel that touches a solid one (4-neighbourhood). */
function addOutline(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const image = ctx.getImageData(0, 0, w, h);
  const src = image.data;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3]! >= SOLID_ALPHA;
  const edges: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) edges.push(y * w + x);
    }
  }
  const [r, g, b] = hexToRgb(PALETTE.outline);
  for (const i of edges) {
    src[i * 4] = r;
    src[i * 4 + 1] = g;
    src[i * 4 + 2] = b;
    src[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
