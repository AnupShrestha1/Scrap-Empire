import * as THREE from 'three';

/** A DOM text label pinned to a point in the world. */
export interface Label {
  readonly el: HTMLDivElement;
  /** World position the label's bottom centre sits on. */
  readonly at: THREE.Vector3;
  visible: boolean;
}

interface Floater {
  el: HTMLDivElement;
  at: THREE.Vector3;
  age: number;
}

const FLOAT_S = 0.9;

/**
 * World-pinned DOM text (prices, orders, "+$12"). HTML text stays sharp and readable at any canvas
 * resolution, which matters at 800×450.
 */
export class Labels {
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

  /** "+$12" rising from a world point and fading out. */
  floating(text: string, at: THREE.Vector3, className = 'cash'): void {
    const el = document.createElement('div');
    el.className = `label3d float ${className}`;
    el.textContent = text;
    this.layer.append(el);
    this.floaters.push({ el, at: at.clone(), age: 0 });
  }

  update(camera: THREE.Camera, width: number, height: number, dt: number): void {
    for (const label of this.labels) {
      const show = label.visible && label.el.textContent !== '' && this.place(label.el, label.at, camera, width, height, 0);
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
