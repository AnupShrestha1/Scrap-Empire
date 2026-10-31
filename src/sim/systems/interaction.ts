import { CARRY, PRICES, SELL_PER_S } from '../../data/balance';
import { ITEM_IDS } from '../../data/items';
import { PURCHASE, UPGRADES, upgradeCost } from '../../data/upgrades';
import { businessLevel } from '../../data/balance';
import { SIM } from '../../config';
import { binCapacity, carryCapacity } from '../effective';
import { PLAYER_PLACE, type SimEvent } from '../events';
import { secondsToTicks, type GameState } from '../state';
import { zoneAt, type CashPadDef, type FactoryDef, type StationDef, type ZoneHit } from '../stations';
import { nextUnbuiltLine } from './manufacturing';
import { randomKind, scatterPiece } from './field';

/** Transient interaction bookkeeping; not saved. */
export interface InteractionState {
  /** "stationId:zone" the player stood in last tick. */
  zoneKey: string | null;
  /** Transfers owed; one item moves each time this reaches 1. */
  budget: number;
  /** Ticks spent in the current zone (cash pads wait before taking money). */
  dwell: number;
  /** Whether a warning was already reported for this visit to the zone. */
  warned: boolean;
}

export function newInteractionState(): InteractionState {
  return { zoneKey: null, budget: 0, dwell: 0, warned: false };
}

/**
 * Moves items between the player and whatever zone they stand in, or takes payment on a cash pad.
 * Item transfers start the moment the player steps in. Returns true if anything changed.
 */
export function stepInteraction(
  state: GameState,
  stations: readonly StationDef[],
  inter: InteractionState,
  events: SimEvent[],
): boolean {
  const p = state.player;
  const hit = zoneAt(stations, p.x, p.y);
  const key = hit ? `${hit.station.id}:${hit.zone}` : null;
  if (key !== inter.zoneKey) {
    inter.zoneKey = key;
    inter.budget = 1;
    inter.dwell = 0;
    inter.warned = false;
  } else if (hit) {
    const rate = hit.zone === 'sell' ? SELL_PER_S : CARRY.transferPerS;
    inter.budget = Math.min(1, inter.budget + rate / SIM.tickRate);
    inter.dwell++;
  }
  if (!hit) return false;
  if (hit.zone === 'buy') return stepPurchase(state, hit.station, inter, events);
  if (hit.zone === 'build') return stepBuild(state, hit.station, inter, events);
  if (inter.budget < 1) return false;
  if (!transferOne(state, hit, inter, events)) return false;
  inter.budget -= 1;
  return true;
}

/**
 * Takes this tick's slice of a payment, after the player has stood still briefly. Warns once per visit
 * when they have no cash. Returns the amount taken (0 if none).
 */
function takePayment(state: GameState, inter: InteractionState, events: SimEvent[], cost: number, paid: number): number {
  if (inter.dwell < secondsToTicks(PURCHASE.delayS)) return 0;
  const owed = cost - paid;
  if (state.money === 0) {
    if (!inter.warned) events.push({ type: 'needCash', amount: owed });
    inter.warned = true;
    return 0;
  }
  const slice = Math.max(1, Math.ceil(cost / secondsToTicks(PURCHASE.payS)));
  const pay = Math.min(slice, owed, state.money);
  state.money -= pay;
  return pay;
}

/** Reports, once per visit and after the usual stand-still, why a pad won't take money yet. */
function warnLocked(inter: InteractionState, events: SimEvent[], why: { level?: number; line?: string }): false {
  if (inter.dwell >= secondsToTicks(PURCHASE.delayS) && !inter.warned) {
    events.push({ type: 'locked', ...why });
    inter.warned = true;
  }
  return false;
}

/** Pays towards the pad's upgrade, a slice per tick. Partial payment is kept. */
function stepPurchase(state: GameState, pad: CashPadDef, inter: InteractionState, events: SimEvent[]): boolean {
  const id = pad.upgrade;
  const level = state.upgrades[id];
  const def = UPGRADES[id];
  if (level >= def.maxLevel) return false;
  if (def.requiresLevel && businessLevel(state.earned) < def.requiresLevel) return warnLocked(inter, events, { level: def.requiresLevel });
  if (def.requiresLine && !state.lines[def.requiresLine]?.built) return warnLocked(inter, events, { line: def.requiresLine });
  const cost = upgradeCost(id, level);
  const pay = takePayment(state, inter, events, cost, state.upgradePaid[id]);
  if (pay === 0) return false;
  state.upgradePaid[id] += pay;
  if (state.upgradePaid[id] >= cost) {
    state.upgrades[id] = level + 1;
    state.upgradePaid[id] = 0;
    events.push({ type: 'upgraded', upgrade: id, level: level + 1 });
    // Staying on the pad buys the next level, after a breath.
    inter.dwell = secondsToTicks(PURCHASE.delayS) - secondsToTicks(PURCHASE.nextLevelPauseS);
  }
  return true;
}

/** Pays towards the factory's next production line. Partial payment is kept. */
function stepBuild(state: GameState, factory: FactoryDef, inter: InteractionState, events: SimEvent[]): boolean {
  const line = nextUnbuiltLine(factory, state);
  if (!line) return false;
  if (line.requiresLevel && businessLevel(state.earned) < line.requiresLevel) {
    return warnLocked(inter, events, { level: line.requiresLevel });
  }
  const pay = takePayment(state, inter, events, line.buildCost, state.buildPaid[line.id]!);
  if (pay === 0) return false;
  state.buildPaid[line.id]! += pay;
  if (state.buildPaid[line.id]! >= line.buildCost) {
    state.lines[line.id]!.built = true;
    state.buildPaid[line.id] = 0;
    events.push({ type: 'built', station: line.id });
    // Staying on the pad moves on to the next line, after a breath.
    inter.dwell = secondsToTicks(PURCHASE.delayS) - secondsToTicks(PURCHASE.nextLevelPauseS);
  }
  return true;
}

function transferOne(
  state: GameState,
  hit: Exclude<ZoneHit, { zone: 'buy' | 'build' }>,
  inter: InteractionState,
  events: SimEvent[],
): boolean {
  const stack = state.player.stack;
  const room = stack.length < carryCapacity(state);
  const id = hit.station.id;

  switch (hit.zone) {
    case 'return': {
      // Giving scrap back can't be undone, so like selling it waits until the player stands still.
      if (inter.dwell < secondsToTicks(PURCHASE.delayS)) return false;
      const index = stack.lastIndexOf('scrap');
      if (index < 0) return false;
      stack.splice(index, 1);
      scatterPiece(state.field, hit.station.zones.field, randomKind(state.field, 1));
      events.push({ type: 'itemMoved', item: 'scrap', from: PLAYER_PLACE, to: id });
      return true;
    }

    case 'input': {
      const machine = state.processors[id]!;
      const recipe = hit.station.recipe;
      const index = stack.lastIndexOf(recipe.input);
      if (index < 0 || machine.hopper >= recipe.hopper) return false;
      stack.splice(index, 1);
      machine.hopper++;
      events.push({ type: 'itemMoved', item: recipe.input, from: PLAYER_PLACE, to: id });
      return true;
    }

    case 'output': {
      const machine = state.processors[id]!;
      if (!room) return false;
      const item = ITEM_IDS.find((i) => machine.tray[i] > 0);
      if (!item) return false;
      machine.tray[item]--;
      stack.push(item);
      events.push({ type: 'itemMoved', item, from: id, to: PLAYER_PLACE });
      return true;
    }

    case 'sell': {
      // Selling can't be undone, so like cash pads it waits until the player stands still.
      if (inter.dwell < secondsToTicks(PURCHASE.delayS)) return false;
      const bin = state.bins[id]!;
      if (bin.count === 0) return false;
      const item = hit.station.item;
      const value = PRICES[item];
      bin.count--;
      state.money += value;
      state.earned += value;
      events.push({ type: 'sold', station: id, item, value });
      return true;
    }

    case 'deposit': {
      const bin = state.bins[id]!;
      const item = hit.station.item;
      const index = stack.lastIndexOf(item);
      if (index < 0) return false;
      if (bin.count >= binCapacity(hit.station, state)) {
        if (!inter.warned) events.push({ type: 'storageFull', station: id, item });
        inter.warned = true;
        return false;
      }
      stack.splice(index, 1);
      bin.count++;
      events.push({ type: 'itemMoved', item, from: PLAYER_PLACE, to: id });
      return true;
    }
  }
}
