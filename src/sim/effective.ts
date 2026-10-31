// Values after upgrades. Systems and views read these instead of the raw balance numbers.
import { CARRY, FIELD, SUPPLIER } from '../data/balance';
import { UPGRADE_EFFECTS as FX } from '../data/upgrades';
import { secondsToTicks, type GameState } from './state';
import type { BinDef, LineDef, ProcessorDef } from './stations';
import type { ItemId } from '../data/items';

export function carryCapacity(state: GameState): number {
  return CARRY.capacity + FX.carryPerLevel * state.upgrades.carry;
}

export function magnetRadius(state: GameState): number {
  return FIELD.magnetRadius + FX.magnetPerLevel * state.upgrades.magnet;
}

export function binCapacity(def: BinDef, state: GameState): number {
  return def.capacity + FX.binPerLevel * state.upgrades.binSize;
}

export function processorCycleTicks(def: ProcessorDef, state: GameState): number {
  const level = def.speedUpgrade ? state.upgrades[def.speedUpgrade] : 0;
  return secondsToTicks(def.recipe.cycleS * FX.shredderCycleFactor ** level);
}

export function supplyLoad(state: GameState): number {
  return SUPPLIER.load + FX.supplyLoadPerStep * Math.ceil(state.upgrades.supply / 2);
}

export function supplyIntervalS(state: GameState): number {
  const shorter = FX.supplyIntervalPerStepS * Math.floor(state.upgrades.supply / 2);
  return Math.max(FX.supplyMinIntervalS, SUPPLIER.intervalS - shorter);
}

/** Output per input after Yield (all outputs) and Extraction (adds copper). */
export function processorOutputs(def: ProcessorDef, state: GameState): Partial<Record<ItemId, number>> {
  const scale = 1 + FX.yieldPerLevel * state.upgrades.shredderYield;
  const out: Partial<Record<ItemId, number>> = {};
  for (const [item, amount] of Object.entries(def.recipe.outputs) as [ItemId, number][]) out[item] = amount * scale;
  const extraction = state.upgrades.extraction;
  if (def.speedUpgrade === 'shredderSpeed' && extraction > 0) {
    out.copper = (out.copper ?? 0) + (FX.copperBase + FX.copperPerLevel * (extraction - 1)) * scale;
  }
  return out;
}

export function lineBatchTicks(line: LineDef, state: GameState): number {
  const level = line.speedUpgrade ? state.upgrades[line.speedUpgrade] : 0;
  return secondsToTicks(line.recipe.batchS * FX.lineCycleFactor ** level);
}
