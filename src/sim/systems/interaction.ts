import { CARRY, PRICES, SELL_PER_S } from '../../data/balance';
import { ITEM_IDS } from '../../data/items';
import { SIM } from '../../config';
import { PLAYER_PLACE, type SimEvent } from '../events';
import type { GameState } from '../state';
import { zoneAt, type ZoneHit } from '../stations';
import type { StationDef } from '../stations';

/** Transient interaction bookkeeping; not saved. */
export interface InteractionState {
  /** "stationId:zone" the player stood in last tick. */
  zoneKey: string | null;
  /** Transfers owed; one item moves each time this reaches 1. */
  budget: number;
  /** Whether "storage full" was already reported for this visit to the zone. */
  warned: boolean;
}

export function newInteractionState(): InteractionState {
  return { zoneKey: null, budget: 0, warned: false };
}

/**
 * Moves items between the player and whatever zone they stand in, at CARRY.transferPerS.
 * The first item moves the moment the player steps in. Returns true if anything moved.
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
    inter.warned = false;
  } else if (hit) {
    const rate = hit.zone === 'sell' ? SELL_PER_S : CARRY.transferPerS;
    inter.budget = Math.min(1, inter.budget + rate / SIM.tickRate);
  }
  if (!hit || inter.budget < 1) return false;
  if (!transferOne(state, hit, inter, events)) return false;
  inter.budget -= 1;
  return true;
}

function transferOne(state: GameState, hit: ZoneHit, inter: InteractionState, events: SimEvent[]): boolean {
  const stack = state.player.stack;
  const room = stack.length < CARRY.capacity;
  const id = hit.station.id;

  switch (hit.zone) {
    case 'take': {
      const pile = state.piles[id]!;
      if (!room || pile.items === 0) return false;
      pile.items--;
      stack.push('scrap');
      events.push({ type: 'itemMoved', item: 'scrap', from: id, to: PLAYER_PLACE });
      return true;
    }

    case 'return': {
      const pile = state.piles[id]!;
      const index = stack.lastIndexOf('scrap');
      if (index < 0) return false;
      stack.splice(index, 1);
      pile.items++;
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
      const bin = state.bins[id]!;
      if (bin.count === 0) return false;
      const item = hit.station.item;
      const value = PRICES[item];
      bin.count--;
      state.money += value;
      events.push({ type: 'sold', station: id, item, value });
      return true;
    }

    case 'deposit': {
      const bin = state.bins[id]!;
      const item = hit.station.item;
      const index = stack.lastIndexOf(item);
      if (index < 0) return false;
      if (bin.count >= hit.station.capacity) {
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
