import { CARRY, PRICES, SELL_PER_S, STAFF } from '../../data/balance';
import { ITEM_IDS } from '../../data/items';
import { PURCHASE, UPGRADES, upgradeCost } from '../../data/upgrades';
import { businessLevel } from '../../data/balance';
import { SIM } from '../../config';
import { binCapacity, carryCapacity } from '../effective';
import { PLAYER_PLACE, type SimEvent } from '../events';
import { secondsToTicks, type GameState } from '../state';
import { zoneAt, type CashPadDef, type FactoryDef, type StaffHutDef, type StationDef, type ZoneHit } from '../stations';
import { nextUnbuiltLine } from './manufacturing';
import { loadOrder } from './bays';
import { randomKind, scatterPiece } from './field';

/** Zones that sell or spend: they wait for PURCHASE.delayS of standing still, shown by a filling ring. */
const CHARGED_ZONES: ReadonlySet<string> = new Set(['sell', 'buy', 'build', 'hire']);

/** Products the outlet buys. */
const PRODUCTS: ReadonlySet<string> = new Set(['sheet', 'can']);

/**
 * How far (0..1) the player is through the stand-still before a sell, upgrade or build pad acts, or
 * undefined when they aren't waiting on one.
 */
export function padCharge(inter: InteractionState): number | undefined {
  if (!inter.zone || !CHARGED_ZONES.has(inter.zone)) return undefined;
  const fraction = inter.dwell / secondsToTicks(PURCHASE.delayS);
  return fraction < 1 ? Math.max(0, fraction) : undefined;
}

/** Transient interaction bookkeeping; not saved. */
export interface InteractionState {
  /** "stationId:zone" the player stood in last tick. */
  zoneKey: string | null;
  /** The zone part of zoneKey. */
  zone: string | null;
  /** Transfers owed; one item moves each time this reaches 1. */
  budget: number;
  /** Ticks spent in the current zone (cash pads wait before taking money). */
  dwell: number;
  /** Whether a warning was already reported for this visit to the zone. */
  warned: boolean;
}

export function newInteractionState(): InteractionState {
  return { zoneKey: null, zone: null, budget: 0, dwell: 0, warned: false };
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
    inter.zone = hit?.zone ?? null;
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
  if (hit.zone === 'hire') return stepHire(state, hit.station, inter, events);
  if (inter.budget < 1) return false;
  if (!transferOne(state, hit, inter, events)) return false;
  inter.budget -= 1;
  return true;
}

/**
 * Takes this tick's slice of a payment, after the player has stood still briefly. Nothing is taken
 * unless the player can pay everything still owed, so cash is never tied up in a half-paid purchase;
 * they're warned once per visit instead. Returns the amount taken (0 if none).
 */
function takePayment(state: GameState, inter: InteractionState, events: SimEvent[], cost: number, paid: number): number {
  if (inter.dwell < secondsToTicks(PURCHASE.delayS)) return 0;
  const owed = cost - paid;
  if (state.money < owed) {
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

/** Pays for the pad's upgrade, a slice per tick. */
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

/** Pays for the next employee; when paid, they appear at the hut. */
function stepHire(state: GameState, hut: StaffHutDef, inter: InteractionState, events: SimEvent[]): boolean {
  const count = state.employees.length;
  const cost = STAFF.costs[count];
  if (cost === undefined) return false;
  const pay = takePayment(state, inter, events, cost, state.hirePaid);
  if (pay === 0) return false;
  state.hirePaid += pay;
  if (state.hirePaid >= cost) {
    const z = hut.zones.hire;
    const id = state.employees.reduce((m, e) => Math.max(m, e.id + 1), 0);
    state.employees.push({ id, x: z.x + z.w / 2 + (count % 2) * 0.3, y: z.y + 0.5, facing: 'down', stack: [] });
    state.hirePaid = 0;
    events.push({ type: 'hired', count: count + 1 });
    inter.dwell = secondsToTicks(PURCHASE.delayS) - secondsToTicks(PURCHASE.nextLevelPauseS);
  }
  return true;
}

/** Pays for the factory's next production line. */
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
  hit: Exclude<ZoneHit, { zone: 'buy' | 'build' | 'hire' }>,
  inter: InteractionState,
  events: SimEvent[],
): boolean {
  const stack = state.player.stack;
  const room = stack.length < carryCapacity(state);
  const id = hit.station.id;

  switch (hit.zone) {
    case 'return': {
      // A short stand-still, so walking over the drop pad doesn't empty the worker's hands.
      if (inter.dwell < secondsToTicks(PURCHASE.returnDelayS)) return false;
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

    case 'lineOutput': {
      const line = state.lines[hit.line.id]!;
      if (!room || line.out === 0) return false;
      line.out--;
      stack.push(hit.line.recipe.output);
      events.push({ type: 'itemMoved', item: hit.line.recipe.output, from: hit.line.id, to: PLAYER_PLACE });
      return true;
    }

    case 'load':
      return loadOrder(hit.station, state.bays[id]!, state, events);

    case 'sell': {
      // Selling can't be undone, so like cash pads it waits until the player stands still.
      if (inter.dwell < secondsToTicks(PURCHASE.delayS)) return false;
      if (hit.station.kind === 'outlet') {
        let index = stack.length - 1;
        while (index >= 0 && !PRODUCTS.has(stack[index]!)) index--;
        if (index < 0) return false;
        const item = stack[index]!;
        stack.splice(index, 1);
        state.money += PRICES[item];
        state.earned += PRICES[item];
        events.push({ type: 'sold', station: id, item, value: PRICES[item] });
        return true;
      }
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
