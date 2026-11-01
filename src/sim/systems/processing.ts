import { ITEM_IDS, METALS, type MetalId } from '../../data/items';
import type { ProcessorStatus, SimEvent } from '../events';
import { secondsToTicks, type ProcessorState } from '../state';
import type { ProcessorDef } from '../stations';

export function trayTotal(state: ProcessorState): number {
  let total = 0;
  for (const id of ITEM_IDS) total += state.tray[id];
  return total;
}

/** Cycle length before upgrades; see effective.ts for the upgraded value. */
export function baseCycleTicks(def: ProcessorDef): number {
  return secondsToTicks(def.recipe.cycleS);
}

/** What one input gives: an amount of iron (fractions carry over) and the chance of each rarer metal. */
export interface Finds {
  iron: number;
  chances: Partial<Record<MetalId, number>>;
}

/**
 * One tick of a processor: start on the next input, advance the cycle, and on completion move the
 * outputs to the tray: the iron, plus a roll for each rarer metal. If the tray might not take everything
 * the machine waits, finished, until it can. Returns true if anything changed.
 */
export function stepProcessor(
  def: ProcessorDef,
  state: ProcessorState,
  cycle: number,
  events: SimEvent[],
  finds: Finds,
  roll: () => number,
  /** Output tray space (the recipe's, raised by upgrades). */
  trayCapacity = def.recipe.tray,
): boolean {
  if (state.progress === 0) {
    if (state.hopper === 0) return false;
    state.hopper--;
    state.progress = 1;
    return true;
  }
  if (state.progress < cycle) state.progress++;
  if (state.progress < cycle) return true;

  // Finished. Wait until the tray has room for the most this input could give.
  const iron = Math.floor(state.carry.iron + finds.iron + 1e-9);
  const rare = METALS.filter((m) => (finds.chances[m] ?? 0) > 0);
  if (trayTotal(state) + iron + rare.length > trayCapacity) return false;

  state.tray.iron += iron;
  state.carry.iron = Math.max(0, state.carry.iron + finds.iron - iron);
  for (const metal of rare) {
    if (roll() >= finds.chances[metal]!) continue;
    state.tray[metal]++;
    events.push({ type: 'found', station: def.id, item: metal });
  }
  state.progress = 0;
  state.shredded++;
  events.push({ type: 'processed', station: def.id, item: def.recipe.input });
  return true;
}

export function processorStatus(def: ProcessorDef, state: ProcessorState, cycle = baseCycleTicks(def)): ProcessorStatus {
  if (state.progress >= cycle) return 'blocked';
  if (state.progress > 0) return 'processing';
  if (trayTotal(state) > 0) return 'ready';
  return 'idle';
}
