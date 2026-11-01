import * as THREE from 'three';

/** A DOM text label pinned to a point in the world. */
export interface Label {
  readonly el: HTMLDivElement;
  /** World position the label's bottom centre sits on. */
  readonly at: THREE.Vector3;
  visible: boolean;
  /** Hidden along with this object (a station that isn't revealed yet). */
  owner?: THREE.Object3D;
}

/** Anything that hands out labels: Labels itself, or a scope that ties them to an owner. */
export interface LabelMaker {
  add(className?: string): Label;
}

interface Floater {
  el: HTMLDivElement;
  at: THREE.Vector3;
  age: number;
}

const FLOAT_S = 0.9;
const MAX_COINS = 8;

/**
 * World-pinned DOM text (prices, orders, "+$12"). HTML text stays sharp and readable at any canvas
 * resolution, which matters at 800×450.
 */
export class Labels implements LabelMaker {
  private readonly layer: HTMLDivElement;
  private readonly labels: Label[] = [];
  private floaters: Floater[] = [];
  private readonly v = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'labels3d';
    parent.append(this.layer);
  }

  add(className = ''): Label {
    const el = document.createElement('div');
    el.className = `label3d ${className}`;
    this.layer.append(el);
    const label = { el, at: new THREE.Vector3(), visible: true };
    this.labels.push(label);
    return label;
  }

  /** A label maker whose labels hide whenever `owner` (or anything above it) is hidden. */
  scoped(owner: THREE.Object3D): LabelMaker {
    return {
      add: (className = '') => {
        const label = this.add(className);
        label.owner = owner;
        return label;
      },
    };
  }

  /** "+$12" rising from a world point and fading out. */
  floating(text: string, at: THREE.Vector3, className = 'cash'): void {
    const el = document.createElement('div');
    el.className = `label3d float ${className}`;
    el.textContent = text;
    this.layer.append(el);
    this.floaters.push({ el, at: at.clone(), age: 0 });
  }

  /**
   * Coins that pop out of a world point and fly into the HUD's cash counter, which bumps as they land.
   * More money, more coins (up to `MAX_COINS`).
   */
  coinBurst(at: THREE.Vector3, camera: THREE.Camera, width: number, height: number, value: number): void {
    const target = document.querySelector('.hud-coin');
    if (!target) return;
    this.v.copy(at).project(camera);
    if (this.v.z > 1) return;
    const sx = (this.v.x * 0.5 + 0.5) * width;
    const sy = (-this.v.y * 0.5 + 0.5) * height;
    const layerBox = this.layer.getBoundingClientRect();
    const box = target.getBoundingClientRect();
    const tx = box.left + box.width / 2 - layerBox.left;
    const ty = box.top + box.height / 2 - layerBox.top;
    const count = Math.max(1, Math.min(MAX_COINS, Math.round(Math.sqrt(value))));
    for (let i = 0; i < count; i++) {
      const coin = document.createElement('div');
      coin.className = 'fly-coin';
      this.layer.append(coin);
      // Pop outwards first, then sweep to the counter.
      const a = Math.random() * Math.PI * 2;
      const pop = 18 + Math.random() * 22;
      const delay = i * 40;
      coin.animate(
        [
          { transform: `translate(${sx}px, ${sy}px) scale(0.4)` },
          { transform: `translate(${sx + Math.cos(a) * pop}px, ${sy + Math.sin(a) * pop - 20}px) scale(1)`, offset: 0.3 },
          { transform: `translate(${tx}px, ${ty}px) scale(0.7)` },
        ],
        { duration: 650, delay, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'backwards' },
      ).onfinish = () => {
        coin.remove();
        const chip = target.closest('.hud-chip');
        chip?.classList.remove('bump');
        // Restart the bump animation.
        void (chip as HTMLElement | null)?.offsetWidth;
        chip?.classList.add('bump');
      };
    }
  }

  update(camera: THREE.Camera, width: number, height: number, dt: number): void {
    for (const label of this.labels) {
      const show =
        label.visible && label.el.textContent !== '' && shown(label.owner) && this.place(label.el, label.at, camera, width, height, 0);
      label.el.style.display = show ? '' : 'none';
    }
    this.floaters = this.floaters.filter((f) => {
      f.age += dt;
      if (f.age >= FLOAT_S) {
        f.el.remove();
        return false;
      }
      const k = f.age / FLOAT_S;
      this.place(f.el, f.at, camera, width, height, -50 * (1 - (1 - k) * (1 - k)));
      f.el.style.opacity = String(1 - k * k);
      return true;
    });
  }

  /** Positions `el` over world point `at`; false when it's behind the camera. */
  private place(el: HTMLElement, at: THREE.Vector3, camera: THREE.Camera, width: number, height: number, liftPx: number): boolean {
    this.v.copy(at).project(camera);
    if (this.v.z > 1) return false;
    const x = (this.v.x * 0.5 + 0.5) * width;
    const y = (-this.v.y * 0.5 + 0.5) * height + liftPx;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    return true;
  }
}

/** Whether an object and all its parents are visible (true for no object). */
function shown(owner: THREE.Object3D | undefined): boolean {
  for (let o: THREE.Object3D | null | undefined = owner; o; o = o.parent) if (!o.visible || o.userData.hideLabels) return false;
  return true;
}
