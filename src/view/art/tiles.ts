import { Tile, type TileId } from '../../sim/grid';
import { PALETTE as C } from './palette';
import { pixelArt, type Pixels } from './pixel';
import { seededRandom } from './random';
import type { Draw } from './textures';

function speckle(p: Pixels, rand: () => number, color: string, count: number): void {
  for (let i = 0; i < count; i++) p.px(Math.floor(rand() * p.w), Math.floor(rand() * p.h), color);
}

function dirt(seed: number): Draw {
  return pixelArt(
    (p) => {
      const rand = seededRandom(seed);
      p.rect(0, 0, p.w, p.h, C.dirt);
      speckle(p, rand, C.dirtDark, 34);
      speckle(p, rand, C.dirtLight, 22);
      // A few gravel stones, lit from the top.
      for (let i = 0; i < 4; i++) {
        const x = 2 + Math.floor(rand() * (p.w - 5));
        const y = 2 + Math.floor(rand() * (p.h - 4));
        p.rect(x, y, 2, 1, C.gravelLight);
        p.rect(x, y + 1, 2, 1, C.gravel);
      }
    },
    { outline: false },
  );
}

const concrete = pixelArt(
  (p) => {
    const rand = seededRandom(11);
    p.rect(0, 0, p.w, p.h, C.concrete);
    speckle(p, rand, C.concreteDark, 26);
    speckle(p, rand, C.concreteLight, 26);
    // Slab seams on two sides, so a pad reads as a grid of slabs.
    p.rect(0, 0, p.w, 1, C.concreteDark);
    p.rect(0, 0, 1, p.h, C.concreteDark);
  },
  { outline: false },
);

const road = pixelArt(
  (p) => {
    const rand = seededRandom(23);
    p.rect(0, 0, p.w, p.h, C.asphalt);
    speckle(p, rand, C.asphaltDark, 60);
    speckle(p, rand, C.asphaltLight, 40);
  },
  { outline: false },
);

/** Flat ground only. Fences and crates are upright objects drawn on top (see objects.ts). */
export const TILESET: readonly Draw[] = [dirt(1), dirt(2), dirt(3), concrete, road];

const DIRT_VARIANTS = 3;

/** Ground tileset index for a tile; anything that isn't concrete or road stands on dirt. */
export function tilesetIndex(tile: TileId, x: number, y: number): number {
  if (tile === Tile.Concrete) return 3;
  if (tile === Tile.Road) return 4;
  return ((Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % DIRT_VARIANTS;
}
