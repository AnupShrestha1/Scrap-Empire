import type Phaser from 'phaser';

export type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/** Gap between atlas frames, so linear filtering never bleeds a neighbour in. */
const ATLAS_PADDING = 2;

/** Packs code-drawn sprites into one canvas (simple shelf packing) so they share a single GPU texture. */
export class AtlasBuilder {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly frames: { name: string; x: number; y: number; w: number; h: number }[] = [];
  private cursorX = ATLAS_PADDING;
  private cursorY = ATLAS_PADDING;
  private rowHeight = 0;

  constructor(private readonly size: number) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = get2d(this.canvas);
  }

  add(name: string, w: number, h: number, draw: Draw): void {
    if (this.cursorX + w + ATLAS_PADDING > this.size) {
      this.cursorX = ATLAS_PADDING;
      this.cursorY += this.rowHeight + ATLAS_PADDING;
      this.rowHeight = 0;
    }
    if (this.cursorY + h + ATLAS_PADDING > this.size) throw new Error(`Atlas is full; cannot fit '${name}'`);

    const { ctx } = this;
    ctx.save();
    ctx.translate(this.cursorX, this.cursorY);
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.clip();
    draw(ctx, w, h);
    ctx.restore();

    this.frames.push({ name, x: this.cursorX, y: this.cursorY, w, h });
    this.cursorX += w + ATLAS_PADDING;
    this.rowHeight = Math.max(this.rowHeight, h);
  }

  /** Hands the canvas to Phaser and registers every frame by name. */
  commit(textures: Phaser.Textures.TextureManager, key: string): void {
    const texture = textures.addCanvas(key, this.canvas);
    if (!texture) throw new Error(`Could not create texture '${key}'`);
    for (const f of this.frames) texture.add(f.name, 0, f.x, f.y, f.w, f.h);
  }
}

/**
 * Draws tiles in one row for a Phaser tileset (margin 1, spacing 2). Each tile's edge pixels are copied
 * one pixel outwards, which stops seams between tiles at fractional camera zoom.
 */
export function buildTileset(
  textures: Phaser.Textures.TextureManager,
  key: string,
  tilePx: number,
  tiles: readonly Draw[],
): void {
  const stride = tilePx + 2;
  const canvas = document.createElement('canvas');
  canvas.width = tiles.length * stride;
  canvas.height = stride;
  const ctx = get2d(canvas);

  tiles.forEach((draw, i) => {
    const x = i * stride + 1;
    const y = 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.rect(0, 0, tilePx, tilePx);
    ctx.clip();
    draw(ctx, tilePx, tilePx);
    ctx.restore();

    ctx.drawImage(canvas, x, y, tilePx, 1, x, y - 1, tilePx, 1);
    ctx.drawImage(canvas, x, y + tilePx - 1, tilePx, 1, x, y + tilePx, tilePx, 1);
    ctx.drawImage(canvas, x, y - 1, 1, stride, x - 1, y - 1, 1, stride);
    ctx.drawImage(canvas, x + tilePx - 1, y - 1, 1, stride, x + tilePx, y - 1, 1, stride);
  });

  if (!textures.addCanvas(key, canvas)) throw new Error(`Could not create texture '${key}'`);
}

function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return ctx;
}
