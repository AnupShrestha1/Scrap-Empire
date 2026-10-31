import { ITEM_IDS } from '../../data/items';
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

/**
 * One tick of a processor: start on the next input, advance the cycle, and on completion move the
 * outputs to the tray. If the tray can't take them the machine waits, finished, until it can.
 * Returns true if anything changed.
 */
export function stepProcessor(
  def: ProcessorDef,
  state: ProcessorState,
  cycle = baseCycleTicks(def),
  events: SimEvent[] = [],
  outputs: Readonly<Partial<Record<(typeof ITEM_IDS)[number], number>>> = def.recipe.outputs,
): boolean {
  if (state.progress === 0) {
    if (state.hopper === 0) return false;
    state.hopper--;
    state.progress = 1;
    return true;
  }
  if (state.progress < cycle) state.progress++;
  if (state.progress < cycle) return true;

  // Finished: work out whole items, keeping fractions for later cycles.
  let produced = 0;
  const whole: Partial<Record<(typeof ITEM_IDS)[number], number>> = {};
  for (const id of ITEM_IDS) {
    const amount = outputs[id];
    if (!amount) continue;
    const n = Math.floor(state.carry[id] + amount + 1e-9);
    whole[id] = n;
    produced += n;
  }
  if (trayTotal(state) + produced > def.recipe.tray) return false;

  for (const id of ITEM_IDS) {
    const amount = outputs[id];
    if (!amount) continue;
    const n = whole[id] ?? 0;
    state.tray[id] += n;
    state.carry[id] = Math.max(0, state.carry[id] + amount - n);
  }
  state.progress = 0;
  events.push({ type: 'processed', station: def.id, item: def.recipe.input });
  return true;
}

export function processorStatus(def: ProcessorDef, state: ProcessorState, cycle = baseCycleTicks(def)): ProcessorStatus {
  if (state.progress >= cycle) return 'blocked';
  if (state.progress > 0) return 'processing';
  if (trayTotal(state) > 0) return 'ready';
  return 'idle';
}
