import * as THREE from 'three';
import { stationLevel } from '../data/unlocks';
import { t } from '../i18n';
import type { StationDef } from '../sim/stations';
import { centre } from './common';
import type { Puffs } from './fx';
import type { Label, LabelMaker } from './labels';

export type RevealState = 'hidden' | 'teased' | 'active';

/** Stations with a solid footprint are never fully hidden: an invisible wall would be baffling. */
const SOLID_KINDS: ReadonlySet<string> = new Set(['processor', 'bin', 'factory', 'staffHut', 'dealer']);

/** How long a newly unlocked station takes to pop in. */
const POP_S = 0.6;

const SILHOUETTE = new THREE.MeshBasicMaterial({ color: 0x2b3044, transparent: true, opacity: 0.55, depthWrite: false });

interface Entry {
  def: StationDef;
  level: number;
  /** Positioned at the station's centre, so it scales from there... */
  outer: THREE.Group;
  /** ...while this undoes the offset, so children keep their world coordinates. */
  inner: THREE.Group;
  sign: Label;
  state: RevealState | null;
  age: number;
}

/**
 * Shows each station according to the business level (docs/PROGRESSION.md §4.1): active when its level
 * is reached, a dark silhouette with a level sign one level before (or earlier, for solid things), and
 * hidden otherwise. A station that becomes active pops in with a puff.
 */
export class Reveal {
  private readonly entries = new Map<string, Entry>();
  private primed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly labels: LabelMaker,
    private readonly puffs: Puffs,
  ) {}

  /** The group a station's objects go in (created on first use). */
  groupFor(def: StationDef): THREE.Group {
    let entry = this.entries.get(def.id);
    if (!entry) {
      const c = centre(def.rect);
      const outer = new THREE.Group();
      outer.position.copy(c);
      const inner = new THREE.Group();
      inner.position.copy(c).negate();
      outer.add(inner);
      this.scene.add(outer);
      // The sign belongs to the outer group, so it shows while the station's own labels are hidden.
      const sign = this.labels.add('reveal-sign');
      sign.at.copy(centre(def.rect, 1.2));
      entry = { def, level: stationLevel(def.id), outer, inner, sign, state: null, age: Infinity };
      this.entries.set(def.id, entry);
    }
    return entry.inner;
  }

  isActive(id: string): boolean {
    const entry = this.entries.get(id);
    return !entry || entry.state === 'active';
  }

  /** Applies the business level; returns stations that just became active (after the first call). */
  update(level: number, dt: number): StationDef[] {
    const revealed: StationDef[] = [];
    for (const entry of this.entries.values()) {
      const solid = SOLID_KINDS.has(entry.def.kind);
      const next: RevealState = level >= entry.level ? 'active' : level === entry.level - 1 || solid ? 'teased' : 'hidden';
      if (next !== entry.state) {
        if (next === 'active' && this.primed && entry.state !== null) {
          entry.age = 0;
          revealed.push(entry.def);
          this.puffs.burst(entry.outer.position, 10, 0.7);
        }
        this.apply(entry, next);
      }
      entry.age += dt;
      const k = Math.min(1, entry.age / POP_S);
      // Grow from nothing with a little overshoot.
      entry.outer.scale.setScalar(k < 1 ? Math.max(0.01, Math.sin(k * Math.PI * 0.75) / Math.sin(Math.PI * 0.75)) : 1);
    }
    this.primed = true;
    return revealed;
  }

  private apply(entry: Entry, state: RevealState): void {
    entry.state = state;
    entry.outer.visible = state !== 'hidden';
    // Prices and counts only once it's open; a teased station shows just its level sign.
    entry.inner.userData.hideLabels = state !== 'active';
    entry.sign.el.textContent = state === 'teased' ? t('reveal.sign', { level: entry.level }) : '';
    entry.inner.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      if (state === 'teased') {
        if (node.userData.revealMaterial === undefined) node.userData.revealMaterial = node.material;
        node.material = SILHOUETTE;
        node.castShadow = false;
      } else if (node.userData.revealMaterial !== undefined) {
        node.material = node.userData.revealMaterial;
        delete node.userData.revealMaterial;
        node.castShadow = true;
      }
    });
  }
}
