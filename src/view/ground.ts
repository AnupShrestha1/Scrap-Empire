import * as THREE from 'three';
import { Tile, type Grid, type TileId } from '../sim/grid';
import { COLORS, fences, hash, lampPost, trees } from './props';
import type { Models } from './assets';

/** Ground texture resolution per tile. */
const PX = 32;

const GROUND_COLOR: Partial<Record<TileId, number>> = {
  [Tile.Dirt]: COLORS.dirt,
  [Tile.Concrete]: COLORS.concrete,
  [Tile.Road]: COLORS.road,
  [Tile.Grass]: COLORS.grass,
  [Tile.Water]: COLORS.water,
  [Tile.Dump]: COLORS.dump,
  // Things standing on the ground: trees and the booth on grass, the rest on the yard floor.
  [Tile.Tree]: COLORS.grass,
  [Tile.Booth]: COLORS.grass,
  [Tile.Fence]: COLORS.dirt,
  [Tile.Lamp]: COLORS.dirt,
  [Tile.Crate]: COLORS.dirt,
};

function tileAt(grid: Grid, x: number, y: number): TileId | undefined {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height ? (grid.tiles[y * grid.width + x] as TileId) : undefined;
}

/** Shades a colour by `f` (-1..1). */
function shade(color: number, f: number): string {
  const c = new THREE.Color(color);
  c.offsetHSL(0, 0, f);
  return `#${c.getHexString()}`;
}

/**
 * The whole yard floor painted into one texture on one plane (one draw call), with a wide grass
 * surround so the camera never sees the edge of the world.
 */
export function buildGround(grid: Grid, models: Models): THREE.Object3D {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = grid.width * PX;
  canvas.height = grid.height * PX;
  const g = canvas.getContext('2d')!;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = tileAt(grid, x, y)!;
      const base = GROUND_COLOR[tile] ?? COLORS.dirt;
      g.fillStyle = shade(base, (hash(x, y) - 0.5) * 0.012);
      g.fillRect(x * PX, y * PX, PX, PX);
      speckle(g, tile, base, x, y);
    }
  }
  roadMarkings(g, grid);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(grid.width, grid.height), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(grid.width / 2, 0, grid.height / 2);
  floor.receiveShadow = true;
  group.add(floor);

  const surround = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 }));
  surround.rotation.x = -Math.PI / 2;
  surround.position.set(grid.width / 2, -0.02, grid.height / 2);
  surround.receiveShadow = true;
  group.add(surround);

  const spots = (t: TileId) => {
    const out: { x: number; y: number }[] = [];
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) if (tileAt(grid, x, y) === t) out.push({ x, y });
    return out;
  };
  group.add(trees(spots(Tile.Tree)));
  group.add(fences((x, y) => tileAt(grid, x, y) === Tile.Fence, spots(Tile.Fence)));
  for (const { x, y } of spots(Tile.Lamp)) {
    const lamp = lampPost();
    lamp.position.set(x + 0.5, 0, y + 0.5);
    group.add(lamp);
  }
  for (const { x, y } of spots(Tile.Crate)) {
    const crate = models.get(hash(x, y) > 0.5 ? 'crateLarge' : 'crateSmall');
    crate.scale.setScalar(0.85);
    crate.position.set(x + 0.5, 0, y + 0.5);
    crate.rotation.y = hash(y, x) * 0.6 - 0.3;
    group.add(crate);
  }
  for (const { x, y } of spots(Tile.Booth)) {
    const booth = models.get('hut');
    booth.scale.setScalar(0.8);
    booth.position.set(x + 0.5, 0, y + 0.5);
    booth.rotation.y = Math.PI / 2;
    group.add(booth);
  }
  return group;
}

/** Small texture details: pebbles on dirt, blades on grass, stains on the dump site, seams on concrete. */
function speckle(g: CanvasRenderingContext2D, tile: TileId, base: number, x: number, y: number): void {
  const n = tile === Tile.Dump ? 7 : tile === Tile.Grass || tile === Tile.Tree ? 5 : tile === Tile.Dirt ? 3 : 0;
  for (let i = 0; i < n; i++) {
    const r = hash(x * 31 + i, y * 17 + i * 7);
    const px = x * PX + hash(x + i * 13, y) * PX;
    const py = y * PX + hash(x, y + i * 11) * PX;
    g.fillStyle = shade(base, r > 0.5 ? 0.05 : -0.06);
    const size = tile === Tile.Dump ? 2 + r * 4 : 2 + r * 2;
    g.fillRect(px, py, size, tile === Tile.Grass || tile === Tile.Tree ? size * 1.8 : size);
  }
  if (tile === Tile.Concrete) {
    g.fillStyle = shade(base, -0.05);
    if (x % 2 === 0) g.fillRect(x * PX, y * PX, 1, PX);
    if (y % 2 === 0) g.fillRect(x * PX, y * PX, PX, 1);
  }
}

/** A dashed white centre line along each horizontal run of road. */
function roadMarkings(g: CanvasRenderingContext2D, grid: Grid): void {
  g.fillStyle = 'rgba(255,255,255,0.75)';
  for (let y = 0; y < grid.height - 1; y++) {
    for (let x = 0; x < grid.width; x++) {
      // The line runs between two road rows.
      if (tileAt(grid, x, y) === Tile.Road && tileAt(grid, x, y + 1) === Tile.Road && tileAt(grid, x, y - 1) !== Tile.Road && x % 2 === 0) {
        g.fillRect(x * PX + 4, (y + 1) * PX - 2, PX - 8, 4);
      }
    }
  }
}
