import type { Rect, StationDef } from './stations';
import type { Vec2 } from './vec';

export const Tile = {
  Dirt: 0,
  Concrete: 1,
  Road: 2,
  Grass: 3,
  Water: 4,
  Fence: 5,
  Crate: 6,
  Tree: 7,
  Lamp: 8,
  Booth: 9,
} as const;
export type TileId = (typeof Tile)[keyof typeof Tile];

const CHAR_TO_TILE: Readonly<Record<string, TileId>> = {
  '.': Tile.Dirt,
  ':': Tile.Concrete,
  '=': Tile.Road,
  g: Tile.Grass,
  '~': Tile.Water,
  '#': Tile.Fence,
  x: Tile.Crate,
  T: Tile.Tree,
  L: Tile.Lamp,
  B: Tile.Booth,
  P: Tile.Dirt,
};

/** A solid area inside one tile, in tile-local coordinates: [x0, x1) × [y0, y1). */
type LocalRect = readonly [x0: number, y0: number, x1: number, y1: number];

const FULL: readonly LocalRect[] = [[0, 0, 1, 1]];
/** Half-thickness of a fence line, in tiles. */
const FENCE_HALF = 0.12;
const LAMP_HALF = 0.15;

/** The yard's static ground and obstacles. Coordinates are in tiles; tile (x, y) covers [x, x + 1) × [y, y + 1). */
export interface Grid {
  readonly width: number;
  readonly height: number;
  /** Row-major tile ids. */
  readonly tiles: Uint8Array;
  /** Row-major solid shapes per tile; undefined means walkable. */
  readonly solids: readonly (readonly LocalRect[] | undefined)[];
  /** Centre of the 'P' tile. */
  readonly playerStart: Vec2;
}

export function parseGrid(rows: readonly string[], stations: readonly StationDef[] = []): Grid {
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

  const tileAtXY = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height ? (tiles[y * width + x] as TileId) : undefined;
  const solids: (readonly LocalRect[] | undefined)[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) solids.push(tileSolids(tileAtXY(x, y)!, x, y, tileAtXY));
  }
  for (const s of stations) addRect(solids, width, height, s.rect);

  return { width, height, tiles, solids, playerStart };
}

function tileSolids(
  tile: TileId,
  x: number,
  y: number,
  at: (x: number, y: number) => TileId | undefined,
): readonly LocalRect[] | undefined {
  switch (tile) {
    case Tile.Water:
    case Tile.Crate:
    case Tile.Tree:
    case Tile.Booth:
      return FULL;
    case Tile.Lamp:
      return [[0.5 - LAMP_HALF, 0.5 - LAMP_HALF, 0.5 + LAMP_HALF, 0.5 + LAMP_HALF]];
    case Tile.Fence: {
      // A post in the middle plus a thin arm towards each fenced neighbour.
      const lo = 0.5 - FENCE_HALF;
      const hi = 0.5 + FENCE_HALF;
      const rects: LocalRect[] = [[lo, lo, hi, hi]];
      if (at(x - 1, y) === Tile.Fence) rects.push([0, lo, 0.5, hi]);
      if (at(x + 1, y) === Tile.Fence) rects.push([0.5, lo, 1, hi]);
      if (at(x, y - 1) === Tile.Fence) rects.push([lo, 0, hi, 0.5]);
      if (at(x, y + 1) === Tile.Fence) rects.push([lo, 0.5, hi, 1]);
      return rects;
    }
    default:
      return undefined;
  }
}

function addRect(solids: (readonly LocalRect[] | undefined)[], width: number, height: number, r: Rect): void {
  for (let y = r.y; y < r.y + r.h; y++) {
    for (let x = r.x; x < r.x + r.w; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) throw new Error(`Station at ${r.x},${r.y} is off the map`);
      solids[y * width + x] = FULL;
    }
  }
}

export function tileAt(grid: Grid, tx: number, ty: number): TileId {
  return grid.tiles[ty * grid.width + tx] as TileId;
}

/**
 * Calls `fn` with every solid rectangle (world coordinates) overlapping the open box
 * (minX, maxX) × (minY, maxY). Everything outside the grid is solid.
 */
export function forEachSolid(
  grid: Grid,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
  fn: (x0: number, y0: number, x1: number, y1: number) => void,
): void {
  const tx0 = Math.floor(minX);
  const ty0 = Math.floor(minY);
  const tx1 = Math.ceil(maxX) - 1;
  const ty1 = Math.ceil(maxY) - 1;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const outside = tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height;
      const rects = outside ? FULL : grid.solids[ty * grid.width + tx];
      if (!rects) continue;
      for (const [x0, y0, x1, y1] of rects) {
        const wx0 = tx + x0;
        const wy0 = ty + y0;
        const wx1 = tx + x1;
        const wy1 = ty + y1;
        if (wx0 < maxX && wx1 > minX && wy0 < maxY && wy1 > minY) fn(wx0, wy0, wx1, wy1);
      }
    }
  }
}

/** True if anything solid overlaps the box (minX, maxX) × (minY, maxY). */
export function boxHitsSolid(grid: Grid, minX: number, minY: number, maxX: number, maxY: number): boolean {
  let hit = false;
  forEachSolid(grid, minX, minY, maxX, maxY, () => {
    hit = true;
  });
  return hit;
}

/** True if the tile is entirely blocked (outside the grid, or a full-tile obstacle). */
export function isSolid(grid: Grid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return true;
  return grid.solids[ty * grid.width + tx] === FULL;
}
