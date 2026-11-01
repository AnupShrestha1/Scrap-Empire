import * as THREE from 'three';
import { stationOpen } from '../sim/effective';
import type { GameState } from '../sim/state';
import type { StationDef } from '../sim/stations';
import { centre } from './common';
import type { Puffs } from './fx';

/** How long a newly opened station takes to pop in. */
const POP_S = 0.6;

interface Entry {
  def: StationDef;
  /** Positioned at the station's centre, so it scales from there... */
  outer: THREE.Group;
  /** ...while this undoes the offset, so children keep their world coordinates. */
  inner: THREE.Group;
  open: boolean | null;
  age: number;
}

/**
 * Shows each station only once it's open (effective.ts stationOpen: its business level reached, and for
 * a bin its metal unlocked). Until then it isn't there at all: not drawn, not solid. A station that opens
 * pops in with a puff; what's coming next is on the HUD instead.
 */
export class Reveal {
  private readonly entries = new Map<string, Entry>();
  private primed = false;

  constructor(
    private readonly scene: THREE.Scene,
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
      entry = { def, outer, inner, open: null, age: Infinity };
      this.entries.set(def.id, entry);
    }
    return entry.inner;
  }

  isActive(id: string): boolean {
    return this.entries.get(id)?.open !== false;
  }

  /** Shows what's open; returns stations that just opened (after the first call). */
  update(state: GameState, dt: number): StationDef[] {
    const revealed: StationDef[] = [];
    for (const entry of this.entries.values()) {
      const open = stationOpen(entry.def, state);
      if (open !== entry.open) {
        if (open && this.primed && entry.open !== null) {
          entry.age = 0;
          revealed.push(entry.def);
          this.puffs.burst(entry.outer.position, 10, 0.7);
        }
        entry.open = open;
        entry.outer.visible = open;
      }
      entry.age += dt;
      const k = Math.min(1, entry.age / POP_S);
      // Grow from nothing with a little overshoot.
      entry.outer.scale.setScalar(k < 1 ? Math.max(0.01, Math.sin(k * Math.PI * 0.75) / Math.sin(Math.PI * 0.75)) : 1);
    }
    this.primed = true;
    return revealed;
  }
}
