// Values after upgrades. Systems and views read these instead of the raw balance numbers.
import { businessLevel, CARRY, FIELD, METAL_FINDS, SHREDDER, STAFF, SUPPLIER } from '../data/balance';
import { METALS, type MetalId, type ProductId } from '../data/items';
import { RECIPES, recipeMetals } from '../data/recipes';
import { UPGRADE_EFFECTS as FX } from '../data/upgrades';
import { secondsToTicks, type GameState, type ProcessorState } from './state';
import type { BinDef, FactoryDef, ProcessorDef, StationDef } from './stations';
import { stationLevel } from '../data/unlocks';

export function carryCapacity(state: GameState): number {
  return CARRY.capacity + FX.carryPerLevel * state.upgrades.carry;
}

export function magnetRadius(state: GameState): number {
  return FIELD.magnetRadius + FX.magnetPerLevel * state.upgrades.magnet;
}

/** How fast employees walk, in tiles per second. */
export function staffSpeed(state: GameState): number {
  return STAFF.speed + FX.staffSpeedPerLevel * state.upgrades.staffSpeed;
}

/** How many items each employee carries. */
export function staffCapacity(state: GameState): number {
  return STAFF.capacity + FX.staffCarryPerLevel * state.upgrades.staffCarry;
}

/**
 * Whether a station is open: unlocked by business level (unlocks.ts), and for a bin, its metal unlocked
 * too. Stations that aren't open aren't drawn, solid or usable.
 */
export function stationOpen(def: StationDef, state: GameState): boolean {
  if (def.kind === 'bin') return metalUnlocked(def.item, state);
  return businessLevel(state.earned) >= stationLevel(def.id);
}

/** A processor's hopper space after Shredder capacity upgrades. */
export function hopperCapacity(def: ProcessorDef, state: GameState): number {
  return def.recipe.hopper + FX.hopperPerLevel * state.upgrades.shredderCapacity;
}

/** A processor's output tray space after Shredder capacity upgrades. */
export function trayCapacity(def: ProcessorDef, state: GameState): number {
  return def.recipe.tray + FX.trayPerLevel * state.upgrades.shredderCapacity;
}

export function binCapacity(def: BinDef, state: GameState): number {
  return def.capacity + FX.binPerLevel * state.upgrades.binSize;
}

/** Cycle length after the speed upgrade; the first few scraps of a game go faster (a warm start). */
export function processorCycleTicks(def: ProcessorDef, state: GameState, machine?: ProcessorState): number {
  const level = def.speedUpgrade ? state.upgrades[def.speedUpgrade] : 0;
  const warm = machine && def.recipe === SHREDDER && machine.shredded < SHREDDER.warmCount;
  return secondsToTicks((warm ? SHREDDER.warmCycleS : def.recipe.cycleS) * FX.shredderCycleFactor ** level);
}

export function supplyLoad(state: GameState): number {
  return SUPPLIER.load + FX.supplyLoadPerStep * Math.ceil(state.upgrades.supply / 2);
}

export function supplyIntervalS(state: GameState): number {
  const shorter = FX.supplyIntervalPerStepS * Math.floor(state.upgrades.supply / 2);
  return Math.max(FX.supplyMinIntervalS, SUPPLIER.intervalS - shorter);
}

/** Whether the shredder can turn up this metal yet (by business level or Extraction level). */
export function metalUnlocked(metal: MetalId, state: GameState): boolean {
  const find = METAL_FINDS[metal];
  if (find.extraction !== undefined) return state.upgrades.extraction >= find.extraction;
  return businessLevel(state.earned) >= (find.businessLevel ?? 1);
}

export function unlockedMetals(state: GameState): MetalId[] {
  return METALS.filter((m) => metalUnlocked(m, state));
}

/**
 * What one scrap gives: `iron` is an amount (fractions carry over between cycles), `chances` the odds of
 * each rarer metal turning up. Yield raises everything; every Extraction level past a metal's unlock
 * raises its chance.
 */
export function shredderFinds(state: GameState): { iron: number; chances: Partial<Record<MetalId, number>> } {
  const scale = 1 + FX.yieldPerLevel * state.upgrades.shredderYield;
  const chances: Partial<Record<MetalId, number>> = {};
  for (const metal of METALS) {
    if (metal === 'iron' || !metalUnlocked(metal, state)) continue;
    const find = METAL_FINDS[metal];
    const levels = Math.max(0, state.upgrades.extraction - (find.extraction ?? 0));
    chances[metal] = Math.min(1, (find.chance + find.perLevel * levels) * scale);
  }
  return { iron: METAL_FINDS.iron.chance * scale, chances };
}

/** A product can be made once every metal in its recipe is unlocked. */
export function productUnlocked(product: ProductId, state: GameState): boolean {
  return recipeMetals(product).every((m) => metalUnlocked(m, state));
}

/** Batch time for a product after the factory's line speed upgrade. */
export function lineBatchTicks(factory: FactoryDef, product: ProductId, state: GameState): number {
  const level = factory.speedUpgrade ? state.upgrades[factory.speedUpgrade] : 0;
  return secondsToTicks(RECIPES[product].batchS * FX.lineCycleFactor ** level);
}
