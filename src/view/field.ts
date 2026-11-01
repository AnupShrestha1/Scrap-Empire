import * as THREE from 'three';
import { PIECE_KINDS } from '../data/scrap';
import { t } from '../i18n';
import type { Simulation } from '../sim/simulation';
import type { DumpDef } from '../sim/stations';
import { bake, fitToFootprint, type ModelKey, type Models } from './assets';
import type { Character } from './character';
import type { Puffs } from './fx';
import type { Label, Labels } from './labels';
import { hash, itemMesh, mat, setText } from './props';

/** Model and size (tiles) for each kind of delivered scrap; kinds without a model are built in code. */
const LOOKS: Readonly<Record<string, { model?: ModelKey; size: number; flat?: boolean }>> = {
  can: { size: 0.45 },
  pipe: { model: 'axle', size: 1.0 },
  gear: { model: 'nut', size: 0.55 },
  plate: { model: 'plate', size: 0.8 },
  tyre: { model: 'tyre', size: 1.0, flat: true },
  door: { model: 'door', size: 1.2, flat: true },
  fridge: { size: 0.9 },
  engine: { model: 'engine', size: 1.2 },
};

/** Pieces drawn per kind before the buffer grows. */
const INITIAL_CAPACITY = 64;
const FALL_S = 0.35;
const FLY_S = 0.22;

interface Flying {
  kind: number;
  yaw: number;
  from: THREE.Vector3;
  to: Character;
  t: number;
}

/**
 * Scrap scattered on the dump site, drawn as one instanced mesh per kind of piece, so a full field costs
 * a handful of draw calls. Delivered pieces fall in with a bounce; collected ones fly onto the stack of
 * whoever picked them up.
 */
export class FieldView {
  private readonly meshes: THREE.InstancedMesh[] = [];
  /** Seconds since each piece appeared, by id (negative while it waits to fall). */
  private readonly age = new Map<number, number>();
  private readonly last = new Map<number, { kind: number; x: number; y: number }>();
  private flying: Flying[] = [];
  private primed = false;
  private readonly title: Label;
  private readonly m = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly p = new THREE.Vector3();
  private readonly s = new THREE.Vector3();
  private readonly to = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    models: Models,
    labels: Labels,
    def: DumpDef,
    /** Who a collected piece flies to: the worker nearest a point. */
    private readonly nearest: (at: THREE.Vector3) => Character,
    private readonly dust: Puffs,
  ) {
    PIECE_KINDS.forEach((kind, i) => {
      const { geometry, material } = bake(template(models, kind.id, kind.item));
      const mesh = new THREE.InstancedMesh(geometry, material, INITIAL_CAPACITY);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.meshes[i] = mesh;
      scene.add(mesh);
    });
    this.title = labels.add('area-title');
    this.title.at.set(def.rect.x + def.rect.w / 2, 0.4, def.rect.y + 0.4);
  }

  update(sim: Simulation, dt: number): void {
    const pieces = sim.state.field.pieces;
    const counts = this.meshes.map(() => 0);
    const seen = new Set<number>();
    for (const piece of pieces) {
      seen.add(piece.id);
      let age = this.age.get(piece.id);
      if (age === undefined) {
        // Pieces already there at the start just appear; new ones tumble out of the truck one by one.
        age = this.primed ? -hash(piece.id, 3) * 0.4 : 1;
      }
      const before = age;
      age += dt;
      this.age.set(piece.id, age);
      // A little dust where a delivered piece lands.
      if (before < FALL_S && age >= FALL_S) this.dust.burst(new THREE.Vector3(piece.x, 0, piece.y), 3, 0.25);
      this.last.set(piece.id, { kind: piece.kind, x: piece.x, y: piece.y });
      this.p.set(piece.x, dropHeight(age), piece.y);
      this.place(piece.kind, counts, hash(piece.id, 1) * Math.PI * 2, 1);
    }
    for (const [id, was] of this.last) {
      if (seen.has(id)) continue;
      this.last.delete(id);
      this.age.delete(id);
      const from = new THREE.Vector3(was.x, 0, was.y);
      this.flying.push({ kind: was.kind, yaw: hash(id, 1) * Math.PI * 2, from, to: this.nearest(from), t: 0 });
    }
    this.flying = this.flying.filter((f) => {
      f.t += dt / FLY_S;
      if (f.t >= 1) return false;
      f.to.stackTop(this.to);
      this.p.lerpVectors(f.from, this.to, f.t);
      this.p.y += Math.sin(f.t * Math.PI) * 0.8;
      this.place(f.kind, counts, f.yaw, 1 - f.t * 0.5);
      return true;
    });
    this.meshes.forEach((mesh, i) => {
      mesh.count = counts[i]!;
      mesh.instanceMatrix.needsUpdate = true;
    });
    this.primed = true;
    setText(this.title, t('dump.title', { count: pieces.length }));
  }

  /** Adds one instance of `kind` at this.p. */
  private place(kind: number, counts: number[], yaw: number, scale: number): void {
    let mesh = this.meshes[kind]!;
    const n = counts[kind]!;
    if (n >= mesh.instanceMatrix.count) mesh = this.grow(kind);
    this.q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    this.s.setScalar(scale);
    mesh.setMatrixAt(n, this.m.compose(this.p, this.q, this.s));
    counts[kind] = n + 1;
  }

  /** Doubles a kind's instance buffer. */
  private grow(kind: number): THREE.InstancedMesh {
    const old = this.meshes[kind]!;
    const mesh = new THREE.InstancedMesh(old.geometry, old.material, old.instanceMatrix.count * 2);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    for (let i = 0; i < old.instanceMatrix.count; i++) {
      old.getMatrixAt(i, this.m);
      mesh.setMatrixAt(i, this.m);
    }
    this.scene.remove(old);
    old.dispose();
    this.scene.add(mesh);
    this.meshes[kind] = mesh;
    return mesh;
  }
}

/** Height while dropping in: a fall, then a small bounce. */
function dropHeight(age: number): number {
  if (age < 0) return 3;
  if (age < FALL_S) {
    const k = age / FALL_S;
    return 3 * (1 - k * k);
  }
  const b = (age - FALL_S) / 0.15;
  return b < 1 ? Math.sin(b * Math.PI) * 0.15 : 0;
}

/** The look of one kind of piece, sitting on the ground at the origin. */
function template(models: Models, id: string, item: Parameters<typeof itemMesh>[0] | undefined): THREE.Object3D {
  const root = new THREE.Group();
  if (item) {
    // Something the player dropped.
    const m = itemMesh(item);
    m.scale.setScalar(1.4);
    m.position.y = 0.1;
    return root.add(m);
  }
  const look = LOOKS[id] ?? { size: 0.4 };
  if (look.model) {
    const model = models.get(look.model);
    if (look.flat) model.rotation.z = Math.PI / 2;
    return root.add(fitToFootprint(new THREE.Group().add(model), look.size));
  }
  if (id === 'can') {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.39, 8), mat(0xb8c4cf));
    can.rotation.z = Math.PI / 2;
    can.position.y = 0.15;
    return root.add(can);
  }
  // A fridge lying on its back.
  const k = look.size / 0.62;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.45 * k, 0.3 * k, 0.62 * k), mat(0xeef1f4));
  body.position.y = 0.15 * k;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04 * k, 0.05 * k, 0.3 * k), mat(0x8a90a0));
  handle.position.set(0.16 * k, 0.32 * k, 0);
  return root.add(body, handle);
}
