import * as THREE from 'three';
import type { ItemId } from '../data/items';
import { PLAYER } from '../data/player';
import type { ModelKey, Models } from './assets';
import { ITEM_HEIGHT, itemMesh } from './props';

/** Characters are scaled up from Kenney's size so they read at our camera distance. */
const SCALE = 1.7;
/** Most items drawn on a back; anything past this is implied. */
const MAX_SHOWN = 24;
/**
 * Speed (tiles/s) each animation is made for. Clips play at about their own pace, nudged by how fast the
 * character really moves: playing the short sprint cycle much faster looks like vibrating.
 */
const PACE = { walk: 2, sprint: PLAYER.speed } as const;

/**
 * A Kenney mini character: idle / walk / sprint animations, turning smoothly to face where it's going,
 * with its carried stack piled on its back and swaying as it walks.
 */
export class Character {
  readonly root = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Record<'idle' | 'walk' | 'sprint', THREE.AnimationAction>;
  private current: THREE.AnimationAction;
  private readonly stack = new THREE.Group();
  private readonly stackMeshes: THREE.Mesh[] = [];
  private shownStack = '';
  private heading = 0;
  private lean = 0;
  private lastX = NaN;
  private lastZ = NaN;
  private smoothSpeed = 0;

  constructor(models: Models, key: ModelKey) {
    const model = models.get(key);
    model.scale.setScalar(SCALE);
    this.root.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    const clip = (name: string) => {
      const c = models.clips(key).find((a) => a.name === name);
      if (!c) throw new Error(`${key} has no '${name}' animation`);
      return this.mixer.clipAction(c);
    };
    this.actions = { idle: clip('idle'), walk: clip('walk'), sprint: clip('sprint') };
    this.current = this.actions.idle;
    this.current.play();
    // On the back, just above the waist.
    this.stack.position.set(0, 0.55, -0.42);
    this.stack.scale.setScalar(1.3);
    this.root.add(this.stack);
  }

  /** Moves to (x, z) this frame; facing and animation follow from the movement. */
  update(dt: number, x: number, z: number, stack: readonly ItemId[]): void {
    const dx = Number.isNaN(this.lastX) ? 0 : x - this.lastX;
    const dz = Number.isNaN(this.lastZ) ? 0 : z - this.lastZ;
    this.lastX = x;
    this.lastZ = z;
    this.root.position.set(x, 0, z);
    const speed = dt > 0 ? Math.hypot(dx, dz) / dt : 0;
    const k = 1 - Math.exp(-12 * dt);
    this.smoothSpeed += (speed - this.smoothSpeed) * k;

    if (speed > 0.2) {
      const target = Math.atan2(dx, dz);
      let diff = target - this.heading;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.heading += diff * (1 - Math.exp(-14 * dt));
    }
    this.root.rotation.y = this.heading;

    const next = this.smoothSpeed < 0.3 ? this.actions.idle : this.smoothSpeed < 3 ? this.actions.walk : this.actions.sprint;
    if (next !== this.current) {
      next.reset().play();
      next.crossFadeFrom(this.current, 0.15, false);
      this.current = next;
    }
    if (next !== this.actions.idle) {
      const pace = next === this.actions.walk ? PACE.walk : PACE.sprint;
      next.timeScale = THREE.MathUtils.clamp(this.smoothSpeed / pace, 0.75, 1.1);
    }
    this.mixer.update(dt);

    this.showStack(stack);
    // The stack leans back as the character speeds up and forward as it stops.
    const accel = speed - this.smoothSpeed;
    this.lean += (THREE.MathUtils.clamp(accel * 0.08, -0.25, 0.25) - this.lean) * (1 - Math.exp(-8 * dt));
    this.stackMeshes.forEach((m, i) => {
      m.position.z = -this.lean * i * 0.04;
    });
  }

  /** Where items fly to when picked up: the top of the stack. */
  stackTop(out: THREE.Vector3): THREE.Vector3 {
    const top = this.stackMeshes.at(-1);
    out.set(0, top ? top.position.y + 0.15 : 0, 0);
    return this.stack.localToWorld(out);
  }

  private showStack(stack: readonly ItemId[]): void {
    const shown = stack.slice(0, MAX_SHOWN);
    const key = shown.join(',');
    if (key === this.shownStack) return;
    this.shownStack = key;
    for (const m of this.stackMeshes) this.stack.remove(m);
    this.stackMeshes.length = 0;
    let y = 0;
    shown.forEach((item, i) => {
      const m = itemMesh(item);
      m.position.y = y + ITEM_HEIGHT[item] / 2;
      m.rotation.y = i % 2 === 0 ? 0 : 0.18;
      if (item === 'scrap') m.rotation.y = (i % 3) * 0.3 - 0.3;
      y += ITEM_HEIGHT[item];
      this.stack.add(m);
      this.stackMeshes.push(m);
    });
  }
}
