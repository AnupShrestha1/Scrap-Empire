import type { Vec2 } from './vec';

export const Tile = { Dirt: 0, Concrete: 1, Road: 2, Fence: 3, Crate: 4 } as const;
export type TileId = (typeof Tile)[keyof typeof Tile];
export const TILE_COUNT = 5;

const CHAR_TO_TILE: Readonly<Record<string, TileId>> = {
  '.': Tile.Dirt,
  ':': Tile.Concrete,
  '=': Tile.Road,
  '#': Tile.Fence,
  x: Tile.Crate,
  P: Tile.Dirt,
};

/** Indexed by TileId. */
const SOLID: readonly boolean[] = [false, false, false, true, true];

/** The yard's static tiles. Coordinates are in tiles; tile (x, y) covers [x, x + 1) × [y, y + 1). */
export interface Grid {
  readonly width: number;
  readonly height: number;
  /** Row-major tile ids. */
  readonly tiles: Uint8Array;
  /** Centre of the 'P' tile. */
  readonly playerStart: Vec2;
}

export function parseGrid(rows: readonly string[]): Grid {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (width === 0) throw new Error('Layout is empty');

  const tiles = new Uint8Array(width * height);
  let playerStart: Vec2 | undefined;
  for (let y = 0; y < height; y++) {
    const row = rows[y]!;
    if (row.length !== width) throw new Error(`Layout row ${y} is ${row.length} tiles wide, expected ${width}`);
    for (let x = 0; x < width; x++) {
      const ch = row[x]!;
      const tile = CHAR_TO_TILE[ch];
      if (tile === undefined) throw new Error(`Unknown layout character '${ch}' at ${x},${y}`);
      tiles[y * width + x] = tile;
      if (ch === 'P') playerStart = { x: x + 0.5, y: y + 0.5 };
    }
  }
  if (!playerStart) throw new Error("Layout has no player start 'P'");
  return { width, height, tiles, playerStart };
}

export function tileAt(grid: Grid, tx: number, ty: number): TileId {
  return grid.tiles[ty * grid.width + tx] as TileId;
}

/** Tiles outside the grid count as solid, so nothing leaves the yard. */
export function isSolid(grid: Grid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return true;
  return SOLID[tileAt(grid, tx, ty)]!;
}

/** True if any solid tile overlaps the box [minX, maxX) × [minY, maxY). */
export function boxHitsSolid(grid: Grid, minX: number, minY: number, maxX: number, maxY: number): boolean {
  const x0 = Math.floor(minX);
  const y0 = Math.floor(minY);
  const x1 = Math.ceil(maxX) - 1;
  const y1 = Math.ceil(maxY) - 1;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isSolid(grid, tx, ty)) return true;
    }
  }
  return false;
}
