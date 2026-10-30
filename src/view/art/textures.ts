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

/** A canvas with `draw` already run on it. */
export function drawToCanvas(w: number, h: number, draw: Draw): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(get2d(canvas), w, h);
  return canvas;
}

export function get2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not available');
  return ctx;
}
