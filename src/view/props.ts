// Objects built in code, in the same flat low-poly style as the Kenney packs: things no free pack has
// (bins, pads, items, scrap bits) and scenery we need many of (trees, fences), which are instanced.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { ItemId } from '../data/items';

export const COLORS = {
  grass: 0x86c25a,
  grassDark: 0x6faa48,
  dirt: 0xd2b07a,
  dump: 0xa5835a,
  concrete: 0xc3c7cf,
  road: 0x5d6170,
  water: 0x4aa8e0,
  trunk: 0x8a5a3c,
  leaves: 0x5fae4a,
  leavesDark: 0x4b9440,
  fence: 0x6d7392,
  fenceRail: 0x8e94b3,
  binWall: 0x5f6589,
  binTrim: 0xf2a13b,
  pad: 0x2f8f57,
  padEdge: 0x1f6b40,
  lamp: 0x4b4f66,
  lampGlow: 0xfff1b0,
} as const;

/** Each item's colour: the stripe on its bin, and the colour of the item itself. */
export const ITEM_COLORS: Readonly<Record<ItemId, number>> = {
  scrap: 0x9c8672,
  iron: 0x7f8ea3,
  aluminium: 0xdde4ec,
  copper: 0xe08a45,
  sheet: 0x9fb3cc,
  can: 0xe2534b,
};

const materials = new Map<number, THREE.MeshStandardMaterial>();

/** One shared flat-shaded material per colour. */
export function mat(color: number): THREE.MeshStandardMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true });
    materials.set(color, m);
  }
  return m;
}

function mesh(geo: THREE.BufferGeometry, color: number): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------------------------------------------------------------------------------------------- items

const ITEM_GEOMETRY: Readonly<Record<ItemId, THREE.BufferGeometry>> = {
  // A crushed bale of scrap metal.
  scrap: new THREE.BoxGeometry(0.34, 0.24, 0.3),
  iron: new THREE.BoxGeometry(0.42, 0.14, 0.24),
  aluminium: new THREE.BoxGeometry(0.42, 0.14, 0.24),
  copper: new THREE.BoxGeometry(0.42, 0.14, 0.24),
  sheet: new THREE.BoxGeometry(0.46, 0.06, 0.34),
  can: new THREE.CylinderGeometry(0.11, 0.11, 0.24, 10),
};

/** How tall one item is when stacked. */
export const ITEM_HEIGHT: Readonly<Record<ItemId, number>> = {
  scrap: 0.26,
  iron: 0.14,
  aluminium: 0.14,
  copper: 0.14,
  sheet: 0.07,
  can: 0.24,
};

export function itemGeometry(item: ItemId): THREE.BufferGeometry {
  return ITEM_GEOMETRY[item];
}

export function itemMesh(item: ItemId): THREE.Mesh {
  return mesh(ITEM_GEOMETRY[item], ITEM_COLORS[item]);
}

// ---------------------------------------------------------------------------------------------- scenery

/** Low-poly trees as two instanced meshes: one draw call each for every trunk and every crown. */
export function trees(spots: readonly { x: number; y: number }[]): THREE.Object3D {
  const group = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.09, 0.12, 0.6, 6).translate(0, 0.3, 0);
  const crownGeo = new THREE.IcosahedronGeometry(0.5, 0).translate(0, 1.05, 0);
  const trunks = new THREE.InstancedMesh(trunkGeo, mat(COLORS.trunk), spots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, mat(COLORS.leaves), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const color = new THREE.Color();
  spots.forEach((spot, i) => {
    const r = hash(spot.x, spot.y);
    const size = 0.85 + r * 0.45;
    q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, r * Math.PI * 2);
    s.setScalar(size);
    p.set(spot.x + 0.5 + (r - 0.5) * 0.3, 0, spot.y + 0.5 + (hash(spot.y, spot.x) - 0.5) * 0.3);
    trunks.setMatrixAt(i, m.compose(p, q, s));
    crowns.setMatrixAt(i, m.compose(p, q, s));
    crowns.setColorAt(i, color.setHex(r > 0.5 ? COLORS.leaves : COLORS.leavesDark));
  });
  for (const im of [trunks, crowns]) {
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  }
  return group;
}

/** Fence posts on every fence tile, with rails joining neighbouring fence tiles. */
export function fences(isFence: (x: number, y: number) => boolean, spots: readonly { x: number; y: number }[]): THREE.Object3D {
  const group = new THREE.Group();
  const postGeo = new THREE.BoxGeometry(0.14, 0.8, 0.14).translate(0, 0.4, 0);
  const railGeo = new THREE.BoxGeometry(1, 0.08, 0.06);
  const rails: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  for (const { x, y } of spots) {
    for (const h of [0.3, 0.62]) {
      if (isFence(x + 1, y)) rails.push(new THREE.Matrix4().makeTranslation(x + 1, h, y + 0.5));
      if (isFence(x, y + 1)) rails.push(new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(x + 0.5, h, y + 1));
    }
  }
  const posts = new THREE.InstancedMesh(postGeo, mat(COLORS.fence), spots.length);
  spots.forEach(({ x, y }, i) => posts.setMatrixAt(i, m.makeTranslation(x + 0.5, 0, y + 0.5)));
  const railMesh = new THREE.InstancedMesh(railGeo, mat(COLORS.fenceRail), rails.length);
  rails.forEach((r, i) => railMesh.setMatrixAt(i, r));
  for (const im of [posts, railMesh]) {
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  }
  return group;
}

export function lampPost(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.09, 2, 6).translate(0, 1, 0), COLORS.lamp));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.08, 0.12).translate(0.2, 2, 0), COLORS.lamp));
  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.18).translate(0.38, 1.94, 0), new THREE.MeshBasicMaterial({ color: COLORS.lampGlow }));
  g.add(glow);
  return g;
}

// ---------------------------------------------------------------------------------------------- stations

/**
 * A storage bin: an open crate with its material's stripe, filling with stacked bars. `fill` takes the
 * stored count and shows up to `slots` bars inside.
 */
export class BinProp {
  readonly root = new THREE.Group();
  private readonly bars: THREE.InstancedMesh;
  private shown = -1;

  constructor(item: ItemId, private readonly slots = 30) {
    const h = 0.75;
    const t = 0.12;
    const size = 1.8;
    const sides = (w: number, extra: number) =>
      [
        [0, -size / 2 + t / 2, size + extra, w],
        [0, size / 2 - t / 2, size + extra, w],
        [-size / 2 + t / 2, 0, w, size],
        [size / 2 - t / 2, 0, w, size],
      ] as const;
    // Floor and walls in one mesh, and a coloured rim along the wall tops (so the material reads from
    // far away) in another: two draw calls per bin.
    const walls = [new THREE.BoxGeometry(size, 0.1, size).translate(0, 0.05, 0)];
    for (const [x, z, w, d] of sides(t, 0)) walls.push(new THREE.BoxGeometry(w, h, d).translate(x, h / 2, z));
    const rims = sides(t + 0.04, 0.04).map(([x, z, w, d]) => new THREE.BoxGeometry(w, 0.1, d).translate(x, h + 0.05, z));
    this.root.add(mesh(mergeGeometries(walls)!, COLORS.binWall), mesh(mergeGeometries(rims)!, ITEM_COLORS[item]));
    this.bars = new THREE.InstancedMesh(ITEM_GEOMETRY[item], mat(ITEM_COLORS[item]), slots);
    this.bars.castShadow = true;
    this.bars.receiveShadow = true;
    this.root.add(this.bars);
    this.fill(0);
  }

  fill(count: number): void {
    const n = Math.min(count, this.slots);
    if (n === this.shown) return;
    this.shown = n;
    const m = new THREE.Matrix4();
    // 3 × 2 bars per layer, alternating direction like a real stack.
    for (let i = 0; i < n; i++) {
      const layer = Math.floor(i / 6);
      const slot = i % 6;
      const a = slot % 3;
      const b = Math.floor(slot / 3);
      const turn = layer % 2 === 1;
      const along = (a - 1) * 0.44;
      const across = (b - 0.5) * 0.5;
      m.makeRotationY(turn ? Math.PI / 2 : 0).setPosition(turn ? across : along, 0.17 + layer * 0.14, turn ? along : across);
      this.bars.setMatrixAt(i, m);
    }
    this.bars.count = n;
    this.bars.instanceMatrix.needsUpdate = true;
  }
}

/** A pallet that shows a pile of items (a machine's output tray, a line's output spot). */
export class PileProp {
  readonly root = new THREE.Group();
  private readonly meshes = new Map<ItemId, THREE.InstancedMesh>();

  constructor(items: readonly ItemId[], private readonly perItem = 12) {
    this.root.add(mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9).translate(0, 0.06, 0), 0xb08050));
    items.forEach((item) => {
      const im = new THREE.InstancedMesh(ITEM_GEOMETRY[item], mat(ITEM_COLORS[item]), perItem);
      im.castShadow = true;
      im.count = 0;
      this.meshes.set(item, im);
      this.root.add(im);
    });
  }

  /** Lays out `counts` as columns side by side on the pallet. */
  show(counts: Partial<Record<ItemId, number>>): void {
    const m = new THREE.Matrix4();
    let column = 0;
    const used = [...this.meshes.keys()].filter((k) => (counts[k] ?? 0) > 0);
    for (const item of used) {
      const im = this.meshes.get(item)!;
      const n = Math.min(counts[item] ?? 0, this.perItem);
      const offset = (column - (used.length - 1) / 2) * 0.3;
      for (let i = 0; i < n; i++) {
        m.makeRotationY((i % 2) * 0.25).setPosition(offset, 0.12 + ITEM_HEIGHT[item] / 2 + i * ITEM_HEIGHT[item], 0);
        im.setMatrixAt(i, m);
      }
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      column++;
    }
    for (const [item, im] of this.meshes) if (!used.includes(item)) im.count = 0;
  }
}

/** A flat pad with a painted icon: one textured plane, one draw call. */
export class PadProp {
  readonly root: THREE.Mesh;

  constructor(w: number, h: number, icon: string, color: number = COLORS.pad) {
    const px = 64;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * px);
    canvas.height = Math.round(h * px);
    const g = canvas.getContext('2d')!;
    g.fillStyle = `#${new THREE.Color(COLORS.padEdge).lerp(new THREE.Color(color), 0.3).getHexString()}`;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    g.fillRect(3, 3, canvas.width - 6, canvas.height - 6);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 4;
    g.setLineDash([8, 5]);
    g.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
    g.fillStyle = '#ffffff';
    g.font = `bold ${Math.round(px * 0.55)}px system-ui, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(icon, canvas.width / 2, canvas.height / 2 + 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.root = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.92, h * 0.92), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    this.root.rotation.x = -Math.PI / 2;
    this.root.position.y = 0.02;
    this.root.receiveShadow = true;
  }

  /** Puts the pad on a rectangle of tiles. */
  placeOn(r: { x: number; y: number; w: number; h: number }): this {
    this.root.position.set(r.x + r.w / 2, 0.02, r.y + r.h / 2);
    return this;
  }
}

/**
 * A ring that fills clockwise: the stand-still timer over a worker's head, and machine progress. Always
 * drawn on top and meant to face the camera (see `face`).
 */
export class RingGauge {
  readonly root = new THREE.Group();
  private readonly fill: THREE.Mesh;
  private shownSteps = -1;
  private static readonly STEPS = 48;

  constructor(
    color = 0xffd76a,
    private readonly size = 1,
  ) {
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.36 * size, 32), overlay(0x13243a, 0.85));
    this.fill = new THREE.Mesh(new THREE.BufferGeometry(), overlay(color, 1));
    back.renderOrder = 10;
    this.fill.renderOrder = 11;
    this.root.add(back, this.fill);
  }

  /** Progress 0..1, or undefined to hide. */
  set(progress: number | undefined): void {
    this.root.visible = progress !== undefined;
    if (progress === undefined) return;
    const steps = Math.round(Math.min(1, Math.max(0, progress)) * RingGauge.STEPS);
    if (steps === this.shownSteps) return;
    this.shownSteps = steps;
    this.fill.geometry.dispose();
    // Clockwise from 12 o'clock.
    this.fill.geometry = new THREE.RingGeometry(0.2 * this.size, 0.3 * this.size, 48, 1, Math.PI / 2, -(steps / RingGauge.STEPS) * Math.PI * 2);
  }

  face(camera: THREE.Camera): void {
    this.root.quaternion.copy(camera.quaternion);
  }
}

function overlay(color: number, opacity: number): THREE.MeshBasicMaterial {
  // Double-sided: the fill is wound clockwise, which faces it away from the camera.
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
}

/** A simple booth with a striped awning: the outlet, and later the Scrap Dealer. */
export function booth(color: number): THREE.Object3D {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.8, 0.9, 0.7).translate(0, 0.45, 0), 0xe9e2d0));
  g.add(mesh(new THREE.BoxGeometry(1.9, 0.08, 0.8).translate(0, 0.94, 0), 0x8a5a3c));
  for (const x of [-0.85, 0.85]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08).translate(x, 1.4, -0.3), 0x8a5a3c));
  for (let i = 0; i < 6; i++) {
    const stripe = mesh(new THREE.BoxGeometry(0.33, 0.06, 0.9), i % 2 ? 0xffffff : color);
    stripe.position.set(-0.83 + i * 0.33, 1.9, 0.05);
    stripe.rotation.x = 0.35;
    g.add(stripe);
  }
  return g;
}

/** A status lamp on a machine: green while working, blue with output to collect, amber waiting, red stuck. */
export const LAMP_COLORS = { processing: 0x5cc84a, ready: 0x4aa8e0, idle: 0xf2c23b, starved: 0xf2c23b, blocked: 0xe0483c } as const;

export function lamp(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: LAMP_COLORS.idle }));
  return m;
}

/** Sets a label's text only when it changed, to spare the DOM. */
export function setText(label: { el: HTMLElement }, text: string): void {
  if (label.el.textContent !== text) label.el.textContent = text;
}

/** Cheap deterministic 0..1 noise from two integers. */
export function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
