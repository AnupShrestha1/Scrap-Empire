// Isometric ground tiles: 2:1 pixel diamonds, 32×16 art pixels (64×32 render).
import { Tile, type TileId } from '../../sim/grid';
import { PALETTE as C } from './palette';
import { pixelArt, type Pixels } from './pixel';
import { seededRandom } from './random';
import type { Draw } from './textures';

/** Half-width of the diamond on art row `row`: rows widen by 2 px a side down to the middle, then narrow. */
function halfWidth(p: Pixels, row: number): number {
  const mid = p.h / 2;
  return row < mid ? (row + 1) * 2 : (p.h - row) * 2;
}

/** Clears everything outside the diamond. Neighbouring diamonds then tile without gaps. */
function cutDiamond(p: Pixels): void {
  const cx = p.w / 2;
  for (let row = 0; row < p.h; row++) {
    const hw = halfWidth(p, row);
    p.clear(0, row, cx - hw, 1);
    p.clear(cx + hw, row, cx - hw, 1);
  }
}

function speckle(p: Pixels, rand: () => number, color: string, count: number): void {
  for (let i = 0; i < count; i++) p.px(Math.floor(rand() * p.w), Math.floor(rand() * p.h), color);
}

function dirt(seed: number): Draw {
  return pixelArt(
    (p) => {
      const rand = seededRandom(seed);
      p.rect(0, 0, p.w, p.h, C.dirt);
      speckle(p, rand, C.dirtDark, 18);
      speckle(p, rand, C.dirtLight, 12);
      for (let i = 0; i < 2; i++) {
        const x = 8 + Math.floor(rand() * 15);
        const y = 4 + Math.floor(rand() * 8);
        p.rect(x, y, 2, 1, C.gravelLight);
        p.rect(x, y + 1, 2, 1, C.gravel);
      }
      cutDiamond(p);
    },
    { outline: false },
  );
}

const concrete = pixelArt(
  (p) => {
    const rand = seededRandom(11);
    p.rect(0, 0, p.w, p.h, C.concrete);
    speckle(p, rand, C.concreteDark, 14);
    speckle(p, rand, C.concreteLight, 14);
    // Seams along the two upper edges, so a pad reads as a grid of slabs.
    const cx = p.w / 2;
    for (let row = 0; row < p.h / 2; row++) {
      const hw = halfWidth(p, row);
      p.rect(cx - hw, row, 2, 1, C.concreteDark);
      p.rect(cx + hw - 2, row, 2, 1, C.concreteDark);
    }
    cutDiamond(p);
  },
  { outline: false },
);

const road = pixelArt(
  (p) => {
    const rand = seededRandom(23);
    p.rect(0, 0, p.w, p.h, C.asphalt);
    speckle(p, rand, C.asphaltDark, 30);
    speckle(p, rand, C.asphaltLight, 20);
    cutDiamond(p);
  },
  { outline: false },
);

function grass(seed: number): Draw {
  return pixelArt(
    (p) => {
      const rand = seededRandom(seed);
      p.rect(0, 0, p.w, p.h, C.grass);
      speckle(p, rand, C.grassDark, 26);
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(rand() * p.w);
        const y = 1 + Math.floor(rand() * (p.h - 2));
        p.rect(x, y, 1, 2, C.grassLight);
      }
      cutDiamond(p);
    },
    { outline: false },
  );
}

const water = pixelArt(
  (p) => {
    const rand = seededRandom(41);
    p.rect(0, 0, p.w, p.h, C.water);
    speckle(p, rand, C.waterDark, 16);
    for (let i = 0; i < 4; i++) {
      const x = 4 + Math.floor(rand() * (p.w - 10));
      const y = 3 + Math.floor(rand() * (p.h - 6));
      p.rect(x, y, 4, 1, C.waterLight);
    }
    cutDiamond(p);
  },
  { outline: false },
);

/** Trampled dump ground: darker than the yard, with specks of debris. (Stains per tile repeated in a grid.) */
function dumpGround(seed: number): Draw {
  return pixelArt(
    (p) => {
      const rand = seededRandom(seed);
      p.rect(0, 0, p.w, p.h, '#93704b');
      speckle(p, rand, '#7a5b3b', 26);
      speckle(p, rand, C.scrapGrey, 6);
      speckle(p, rand, C.rust, 5);
      cutDiamond(p);
    },
    { outline: false },
  );
}

/** Ground tile art. Fences, trees and other upright things are drawn on top as objects. */
export const TILESET: readonly Draw[] = [
  dirt(1),
  dirt(2),
  dirt(3),
  concrete,
  road,
  grass(51),
  grass(52),
  water,
  dumpGround(60),
  dumpGround(61),
  dumpGround(62),
  dumpGround(63),
  dumpGround(65),
];

const VARIANTS = 3;

/** Ground tile index for a tile. Trees and the booth stand on grass; other objects on dirt. */
export function tilesetIndex(tile: TileId, x: number, y: number): number {
  const pick = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  switch (tile) {
    case Tile.Concrete:
      return 3;
    case Tile.Road:
      return 4;
    case Tile.Grass:
    case Tile.Tree:
    case Tile.Booth:
      return 5 + (pick % 2);
    case Tile.Water:
      return 7;
    case Tile.Dump:
      return 8 + (pick % 5);
    default:
      return pick % VARIANTS;
  }
}
