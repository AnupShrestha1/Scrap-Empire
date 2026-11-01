import * as THREE from 'three';
import type { Simulation } from '../sim/simulation';
import type { Rect } from '../sim/stations';
import type { Label } from './labels';

/** Something drawn from simulation state every frame. */
export interface View {
  update(sim: Simulation, dt: number, timeMs: number, camera: THREE.Camera): void;
}

/** The centre of a rectangle of tiles, at height `y`. */
export const centre = (r: Rect, y = 0): THREE.Vector3 => new THREE.Vector3(r.x + r.w / 2, y, r.y + r.h / 2);

/** Two-line pad label: a small name over the price (or why it's locked). */
export function padTitle(label: Label, name: string, price: string, locked: boolean): void {
  const key = `${name}|${price}`;
  if (label.el.dataset.key !== key) {
    label.el.dataset.key = key;
    label.el.innerHTML = '';
    const small = document.createElement('small');
    small.textContent = name;
    label.el.append(small, price);
  }
  label.el.classList.toggle('locked', locked);
}
