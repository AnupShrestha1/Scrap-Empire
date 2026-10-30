import type Phaser from 'phaser';
import { VIEW } from '../config';
import { tileAt, type Grid } from '../sim/grid';
import { TILESET, tilesetIndex } from './art/tiles';
import { drawToCanvas, get2d } from './art/textures';
import { toScreen, type IsoProjection } from './iso';

/** Largest texture side every target GPU accepts. Bigger yards will need the ground split into chunks. */
const MAX_TEXTURE_SIDE = 4096;

/**
 * Paints every ground diamond into one canvas texture, so the whole floor is a single image and a
 * single draw call. Phaser's isometric tilemaps only load from Tiled files, so we bake our own.
 */
export function bakeGround(textures: Phaser.Textures.TextureManager, key: string, grid: Grid, proj: IsoProjection): void {
  if (proj.width > MAX_TEXTURE_SIDE || proj.height > MAX_TEXTURE_SIDE) {
    throw new Error(`Yard is too big for one ground texture (${proj.width}×${proj.height})`);
  }
  const tiles = TILESET.map((draw) => drawToCanvas(VIEW.tileW, VIEW.tileH, draw));
  const canvas = document.createElement('canvas');
  canvas.width = proj.width;
  canvas.height = proj.height;
  const ctx = get2d(canvas);
  ctx.imageSmoothingEnabled = false;

  const top = { x: 0, y: 0 };
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      toScreen(proj, x, y, top);
      ctx.drawImage(tiles[tilesetIndex(tileAt(grid, x, y), x, y)]!, top.x - VIEW.tileW / 2, top.y);
    }
  }
  if (!textures.addCanvas(key, canvas)) throw new Error(`Could not create texture '${key}'`);
}
