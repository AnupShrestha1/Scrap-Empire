import * as THREE from 'three';
import { Tile, type Grid, type TileId } from '../sim/grid';
import { COLORS, fences, hash, lampPost, trees } from './props';
import { bake, fitToFootprint, type Models } from './assets';

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
      g.fillStyle = shade(base, 0);
      g.fillRect(x * PX, y * PX, PX, PX);
    }
  }
  // Soft blotches that ignore tile edges, so the ground reads as one surface rather than a grid.
  for (const tile of [Tile.Dirt, Tile.Grass, Tile.Dump]) blotches(g, grid, tile);
  dumpDetails(g, grid);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = tileAt(grid, x, y)!;
      speckle(g, tile, GROUND_COLOR[tile] ?? COLORS.dirt, x, y);
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
  group.add(trees([...spots(Tile.Tree), ...outerTrees(grid)]));
  group.add(fences((x, y) => tileAt(grid, x, y) === Tile.Fence, spots(Tile.Fence)));
  // Things that never move are merged into one mesh (a draw call per material) at the end.
  const statics = new THREE.Group();
  for (const { x, y } of spots(Tile.Lamp)) {
    const lamp = lampPost();
    lamp.position.set(x + 0.5, 0, y + 0.5);
    statics.add(lamp);
  }
  for (const { x, y } of spots(Tile.Crate)) {
    const crate = models.get(hash(x, y) > 0.5 ? 'crateLarge' : 'crateSmall');
    crate.scale.setScalar(0.85);
    crate.position.set(x + 0.5, 0, y + 0.5);
    crate.rotation.y = hash(y, x) * 0.6 - 0.3;
    statics.add(crate);
  }
  for (const { x, y } of spots(Tile.Booth)) {
    const booth = models.get('hut');
    booth.scale.setScalar(0.8);
    booth.position.set(x + 0.5, 0, y + 0.5);
    booth.rotation.y = Math.PI / 2;
    statics.add(booth);
  }
  statics.add(surroundings(grid, models));
  return group.add(staticMesh(statics));
}

/** Flattens a group of scenery that never moves into one shadow-casting mesh. */
function staticMesh(obj: THREE.Object3D): THREE.Mesh {
  const { geometry, material } = bake(obj);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** How far past the map edge the scenery reaches, in tiles. */
const OUTSKIRTS = 12;

/** Is (x, y) outside the map, where roads run on to the horizon? */
function onOuterRoad(grid: Grid, x: number, y: number): boolean {
  if (y < 0 || y >= grid.height) return false;
  if (x < 0) return tileAt(grid, 0, y) === Tile.Road;
  if (x >= grid.width) return tileAt(grid, grid.width - 1, y) === Tile.Road;
  return false;
}

/** Trees scattered in a band around the map (not on roads, water or the decorated east side). */
function outerTrees(grid: Grid): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = -OUTSKIRTS; y < grid.height; y++) {
    for (let x = -OUTSKIRTS; x < grid.width + OUTSKIRTS; x++) {
      const inside = x >= 0 && y >= 0 && x < grid.width && y < grid.height;
      if (inside || onOuterRoad(grid, x, y) || (x >= grid.width && y >= 2)) continue;
      // Water runs along the south; keep the shore clear.
      if (y >= grid.height - 4) continue;
      if (hash(x + 100, y + 100) < 0.32) out.push({ x, y });
    }
  }
  return out;
}

/** Industrial neighbours east of the gate: container stacks, tanks, an office and a water tower. */
const DECOR: readonly { model: Parameters<Models['get']>[0]; x: number; y: number; size: number; turn?: number; stack?: number }[] = [
  { model: 'containerA', x: 59, y: 4, size: 3, turn: 0.5 },
  { model: 'containerB', x: 59, y: 4, size: 3, turn: 0.5, stack: 1 },
  { model: 'containerC', x: 62, y: 5.5, size: 3, turn: 0.5 },
  { model: 'waterTower', x: 65, y: 3, size: 2.2 },
  { model: 'office', x: 61, y: 19, size: 5 },
  { model: 'tank', x: 57.5, y: 17.5, size: 2.2, turn: 0.5 },
  { model: 'tank', x: 57.5, y: 21, size: 2.2, turn: 0.5 },
  { model: 'containerC', x: 58, y: 24.5, size: 3 },
  { model: 'containerA', x: 61.5, y: 24.5, size: 3 },
];

/** Roads and water carried on past the map edge, and the industrial estate beyond the east gate. */
function surroundings(grid: Grid, models: Models): THREE.Object3D {
  const group = new THREE.Group();
  const plane = (x: number, y: number, w: number, h: number, color: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x + w / 2, -0.01, y + h / 2);
    m.receiveShadow = true;
    group.add(m);
  };
  for (const [edge, x0] of [[0, -OUTSKIRTS * 3], [grid.width - 1, grid.width]] as const) {
    let start = -1;
    for (let y = 0; y <= grid.height; y++) {
      const road = y < grid.height && tileAt(grid, edge, y) === Tile.Road;
      if (road && start < 0) start = y;
      if (!road && start >= 0) {
        plane(x0, start, OUTSKIRTS * 3, y - start, COLORS.road);
        start = -1;
      }
    }
  }
  // The water along the south edge widens into a lake.
  plane(-OUTSKIRTS * 3, grid.height - 3, grid.width + OUTSKIRTS * 6, OUTSKIRTS * 3, COLORS.water);
  for (const d of DECOR) {
    const obj = new THREE.Group().add(fitToFootprint(models.get(d.model), d.size));
    obj.position.set(d.x, (d.stack ?? 0) * 1.3, d.y);
    obj.rotation.y = (d.turn ?? 0) * Math.PI;
    group.add(obj);
  }
  return group;
}

/** Ground kinds that blend into each other: blotches and tracks may cross between their tiles. */
function sameGround(a: TileId | undefined, b: TileId): boolean {
  const ground = (t: TileId | undefined) => (t === Tile.Tree || t === Tile.Booth ? Tile.Grass : t === Tile.Fence || t === Tile.Lamp || t === Tile.Crate ? Tile.Dirt : t);
  return ground(a) === ground(b);
}

/** Restricts drawing to the tiles of one ground kind. */
function clipTo(g: CanvasRenderingContext2D, grid: Grid, tile: TileId): void {
  g.beginPath();
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) if (sameGround(tileAt(grid, x, y), tile)) g.rect(x * PX, y * PX, PX, PX);
  }
  g.clip();
}

/** Large soft light and dark patches over every tile of one kind. */
function blotches(g: CanvasRenderingContext2D, grid: Grid, tile: TileId): void {
  const base = GROUND_COLOR[tile]!;
  const strength = tile === Tile.Dump ? 0.07 : 0.035;
  g.save();
  clipTo(g, grid, tile);
  for (let y = 0; y < grid.height; y += 2) {
    for (let x = 0; x < grid.width; x += 2) {
      if (!sameGround(tileAt(grid, x, y), tile)) continue;
      const r = hash(x * 7 + 3, y * 13 + 5);
      const cx = (x + hash(x, y * 3) * 2) * PX;
      const cy = (y + hash(x * 5, y) * 2) * PX;
      const radius = PX * (1.2 + r * 1.8);
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, radius);
      grad.addColorStop(0, shade(base, r > 0.5 ? strength : -strength));
      grad.addColorStop(1, `${shade(base, r > 0.5 ? strength : -strength)}00`);
      g.fillStyle = grad;
      g.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    }
  }
  g.restore();
}

/**
 * The dump site's character: a darker trodden rim, tyre tracks from where the supplier truck backs in,
 * and scattered stones.
 */
function dumpDetails(g: CanvasRenderingContext2D, grid: Grid): void {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (tileAt(grid, x, y) !== Tile.Dump) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + 1);
      maxY = Math.max(maxY, y + 1);
    }
  }
  if (minX === Infinity) return;
  g.save();
  clipTo(g, grid, Tile.Dump);
  // Trodden rim.
  g.strokeStyle = shade(COLORS.dump, -0.06);
  g.lineWidth = 6;
  g.strokeRect(minX * PX + 3, minY * PX + 3, (maxX - minX) * PX - 6, (maxY - minY) * PX - 6);
  // Tyre tracks fanning out from the road at the west edge.
  g.strokeStyle = shade(COLORS.dump, -0.05);
  g.lineWidth = 5;
  const midY = (minY + maxY) / 2;
  for (const bend of [-3, 2.5]) {
    for (const offset of [-0.35, 0.35]) {
      g.beginPath();
      g.moveTo(minX * PX, (midY + offset) * PX);
      g.quadraticCurveTo((minX + 5) * PX, (midY + offset) * PX, (minX + 9) * PX, (midY + bend + offset) * PX);
      g.stroke();
    }
  }
  // Stones.
  for (let i = 0; i < (maxX - minX) * (maxY - minY) * 1.2; i++) {
    const sx = (minX + hash(i, 17) * (maxX - minX)) * PX;
    const sy = (minY + hash(29, i) * (maxY - minY)) * PX;
    const size = 2 + hash(i, i) * 3;
    g.fillStyle = hash(i, 3) > 0.5 ? '#8f8a80' : '#b4ab98';
    g.beginPath();
    g.ellipse(sx, sy, size, size * 0.7, hash(i, 5) * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Small texture details: pebbles on dirt, blades on grass, seams on concrete. */
function speckle(g: CanvasRenderingContext2D, tile: TileId, base: number, x: number, y: number): void {
  const n = tile === Tile.Grass || tile === Tile.Tree ? 5 : tile === Tile.Dirt ? 2 : 0;
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
