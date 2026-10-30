// Values after upgrades. Systems and views read these instead of the raw balance numbers.
import { CARRY, SUPPLIER } from '../data/balance';
import { UPGRADE_EFFECTS as FX } from '../data/upgrades';
import { secondsToTicks, type GameState } from './state';
import type { BinDef, ProcessorDef } from './stations';

export function carryCapacity(state: GameState): number {
  return CARRY.capacity + FX.carryPerLevel * state.upgrades.carry;
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
