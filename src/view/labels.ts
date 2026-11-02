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

interface Placed {
  label: Label;
  x: number;
  y: number;
  w: number;
  /** Distance from the middle of the screen. */
  d: number;
}

const FLOAT_S = 0.9;
/** Gap kept between a pad title and the screen edge. */
const EDGE_PX = 4;
/** Height of a pad title box, near enough, for overlap checks. */
const PAD_TITLE_H = 40;
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
  private readonly widths = new WeakMap<HTMLElement, { text: string; w: number }>();

  constructor(parent: HTMLElement) {
    this.layer = document.createElement('div');
    this.layer.className = 'labels3d';
    // First in the UI layer, so the HUD, cards and banners always draw over world labels.
    parent.prepend(this.layer);
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
    const pads: Placed[] = [];
    for (const label of this.labels) {
      const at = label.visible && label.el.textContent !== '' && shown(label.owner) ? this.project(label.at, camera, width, height) : null;
      if (at && label.el.classList.contains('pad-title')) {
        // Pad titles are boxes: keep them on screen (only for pads that are), and settle overlaps below.
        if (at.x < 0 || at.x > width) {
          label.el.style.display = 'none';
          continue;
        }
        const w = this.widthOf(label.el);
        pads.push({ label, x: Math.min(Math.max(at.x, w / 2 + EDGE_PX), width - w / 2 - EDGE_PX), y: at.y, w, d: Math.hypot(at.x - width / 2, at.y - height / 2) });
        continue;
      }
      if (at && label.el.classList.contains('area-title') && at.x >= 0 && at.x <= width) {
        // Area names (the dump site) are kept on screen too, but never hidden by other labels.
        const w = this.widthOf(label.el);
        at.x = Math.min(Math.max(at.x, w / 2 + EDGE_PX), width - w / 2 - EDGE_PX);
      }
      if (at) this.move(label.el, at.x, at.y);
      label.el.style.display = at ? '' : 'none';
    }
    // Where pad titles overlap (packed pads on a narrow phone screen), the one nearest the middle of the
    // screen, where the player is, wins and the others hide until the player walks closer.
    pads.sort((a, b) => a.d - b.d);
    const kept: Placed[] = [];
    for (const p of pads) {
      const clash = kept.some((k) => Math.abs(k.x - p.x) < (k.w + p.w) / 2 + 2 && Math.abs(k.y - p.y) < PAD_TITLE_H);
      if (!clash) {
        kept.push(p);
        this.move(p.label.el, p.x, p.y);
      }
      p.label.el.style.display = clash ? 'none' : '';
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
    const p = this.project(at, camera, width, height);
    if (p) this.move(el, p.x, p.y + liftPx);
    return p !== null;
  }

  /** Screen position of a world point, or null when it's behind the camera. */
  private project(at: THREE.Vector3, camera: THREE.Camera, width: number, height: number): { x: number; y: number } | null {
    this.v.copy(at).project(camera);
    if (this.v.z > 1) return null;
    return { x: (this.v.x * 0.5 + 0.5) * width, y: (-this.v.y * 0.5 + 0.5) * height };
  }

  private move(el: HTMLElement, x: number, y: number): void {
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
  }

  /** A label's width, measured again only when its text changes (measuring every frame forces layout). */
  private widthOf(el: HTMLElement): number {
    const cached = this.widths.get(el);
    if (cached && cached.text === el.textContent) return cached.w;
    const shownBefore = el.style.display;
    el.style.display = '';
    const w = el.offsetWidth;
    el.style.display = shownBefore;
    this.widths.set(el, { text: el.textContent ?? '', w });
    return w;
  }
}

/** Whether an object and all its parents are visible (true for no object). */
function shown(owner: THREE.Object3D | undefined): boolean {
  for (let o: THREE.Object3D | null | undefined = owner; o; o = o.parent) if (!o.visible || o.userData.hideLabels) return false;
  return true;
}
