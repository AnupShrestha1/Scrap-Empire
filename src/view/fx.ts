// Short-lived effects: puffs of dust and smoke, and items flying between stacks and machines. Each is
// one instanced mesh per look, so a burst of them costs a single draw call.

import * as THREE from 'three';
import type { ItemId } from '../data/items';
import { itemGeometry, itemMaterial } from './props';

interface Puff {
  at: THREE.Vector3;
  rise: number;
  size: number;
  age: number;
  life: number;
}

/** Soft low-poly puffs that swell, rise and shrink away: dust, exhaust, build smoke. */
export class Puffs {
  readonly root: THREE.InstancedMesh;
  private list: Puff[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();

  constructor(color: number, private readonly max = 160) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true });
    this.root = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), material, max);
    this.root.count = 0;
    this.root.frustumCulled = false;
  }

  /** One puff at `at`, `size` tiles across at its biggest. */
  add(at: THREE.Vector3, size = 0.4, life = 0.6, rise = 0.6): void {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ at: at.clone(), rise, size, age: 0, life });
  }

  /** A ring of puffs around a point on the ground, e.g. where something landed. */
  burst(at: THREE.Vector3, count = 5, size = 0.35): void {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random();
      this.add(at.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, 0.05, Math.sin(a) * 0.3)), size * (0.7 + Math.random() * 0.6), 0.45, 0.3);
    }
  }

  update(dt: number): void {
    this.list = this.list.filter((p) => (p.age += dt) < p.life);
    this.list.forEach((p, i) => {
      const k = p.age / p.life;
      // Swell fast, then shrink away.
      const scale = p.size * Math.sin(Math.min(1, k * 1.6) * Math.PI * 0.5) * (1 - k * k);
      this.p.copy(p.at).y += p.rise * k;
      this.s.setScalar(Math.max(0.001, scale));
      this.root.setMatrixAt(i, this.m.compose(this.p, this.q, this.s));
    });
    this.root.count = this.list.length;
    this.root.instanceMatrix.needsUpdate = true;
  }
}

/** Where a flying item heads: a fixed point, or something that moves (a worker's stack). */
export type Target = THREE.Vector3 | { stackTop(out: THREE.Vector3): THREE.Vector3 };

interface Flight {
  item: ItemId;
  from: THREE.Vector3;
  to: Target;
  t: number;
  spin: number;
}

const FLY_S = 0.28;

/**
 * Items arcing from one place to another: from a worker's stack into a machine or bin, from a tray or
 * line onto a stack, from a bin into the factory. One instanced mesh per item type.
 */
export class Flyers {
  readonly root = new THREE.Group();
  private readonly meshes = new Map<ItemId, THREE.InstancedMesh>();
  private list: Flight[] = [];
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly e = new THREE.Euler();
  private readonly s = new THREE.Vector3(1, 1, 1);
  private readonly p = new THREE.Vector3();
  private readonly to = new THREE.Vector3();

  constructor(items: readonly ItemId[], private readonly max = 48) {
    for (const item of items) {
      const mesh = new THREE.InstancedMesh(itemGeometry(item), itemMaterial(item), max);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      this.meshes.set(item, mesh);
      this.root.add(mesh);
    }
  }

  launch(item: ItemId, from: THREE.Vector3, to: Target): void {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push({ item, from: from.clone(), to, t: 0, spin: Math.random() * 2 - 1 });
  }

  update(dt: number): void {
    this.list = this.list.filter((f) => (f.t += dt / FLY_S) < 1);
    const counts = new Map<ItemId, number>();
    for (const f of this.list) {
      const mesh = this.meshes.get(f.item);
      if (!mesh) continue;
      const end = f.to instanceof THREE.Vector3 ? f.to : f.to.stackTop(this.to);
      this.p.lerpVectors(f.from, end, f.t);
      this.p.y += Math.sin(f.t * Math.PI) * 0.9;
      this.q.setFromEuler(this.e.set(f.t * f.spin * 4, f.t * f.spin * 6, 0));
      const n = counts.get(f.item) ?? 0;
      mesh.setMatrixAt(n, this.m.compose(this.p, this.q, this.s));
      counts.set(f.item, n + 1);
    }
    for (const [item, mesh] of this.meshes) {
      mesh.count = counts.get(item) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
