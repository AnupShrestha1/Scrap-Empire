import { businessLevel, ORDERS, PRICES } from '../../data/balance';
import type { ItemId } from '../../data/items';
import type { SimEvent } from '../events';
import { secondsToTicks, type BayState, type GameState } from '../state';
import type { BayDef, FactoryDef } from '../stations';
import { nextRandom } from './field';

/** What the factory's built lines are set to make: what buyer trucks may order. */
export function orderableItems(factories: readonly FactoryDef[], state: GameState): ItemId[] {
  const items = new Set<ItemId>();
  for (const f of factories) {
    for (const line of f.lines) {
      const st = state.lines[line.id];
      if (st?.built) items.add(st.product);
    }
  }
  return [...items];
}

/** The first product made in a game, if one is waiting on a line: the first truck comes for it at once. */
function firstProduct(factories: readonly FactoryDef[], state: GameState): ItemId | undefined {
  for (const f of factories) {
    for (const line of f.lines) {
      const st = state.lines[line.id];
      if (st?.built && st.out > 0 && st.outItem) return st.outItem;
    }
  }
  return undefined;
}

/** What a filled order pays: base price plus the order bonus. */
export function orderValue(bay: BayState): number {
  return bay.item ? Math.round(PRICES[bay.item] * bay.want * ORDERS.bonus) : 0;
}

/**
 * A buyer truck's cycle in one bay: after a gap, a truck backs in with an order for something the factory
 * makes, waits while it's loaded (see loadOrder), then drives off — paid if the order was filled, or
 * unpaid once its patience runs out. No trucks come until a production line is built.
 */
export function stepBay(def: BayDef, bay: BayState, state: GameState, factories: readonly FactoryDef[], events: SimEvent[]): boolean {
  switch (bay.phase) {
    case 'empty': {
      if (def.requiresLevel && businessLevel(state.earned) < def.requiresLevel) return false;
      // The very first product brings a truck straight away, wanting just a few: the bay explains itself.
      const first = state.firstOrder ? undefined : firstProduct(factories, state);
      if (first) {
        state.firstOrder = true;
        bay.phase = 'arriving';
        bay.timer = secondsToTicks(ORDERS.driveInS);
        bay.item = first;
        bay.want = ORDERS.firstAmount;
        bay.have = 0;
        return true;
      }
      // Until then, no trucks: the first one comes for the first product.
      if (!state.firstOrder) return false;
      const items = orderableItems(factories, state);
      if (items.length === 0) return false;
      if (--bay.timer > 0) return false;
      bay.phase = 'arriving';
      bay.timer = secondsToTicks(ORDERS.driveInS);
      bay.item = items[Math.floor(nextRandom(state.field) * items.length)]!;
      bay.want = ORDERS.minAmount + Math.floor(nextRandom(state.field) * (ORDERS.maxAmount - ORDERS.minAmount + 1));
      bay.have = 0;
      return true;
    }
    case 'arriving':
      if (--bay.timer > 0) return false;
      bay.phase = 'waiting';
      bay.timer = secondsToTicks(ORDERS.patienceS);
      events.push({ type: 'orderArrived', bay: def.id, item: bay.item!, want: bay.want });
      return true;
    case 'waiting':
      if (--bay.timer > 0) return false;
      bay.phase = 'leaving';
      bay.timer = secondsToTicks(ORDERS.driveOutS);
      events.push({ type: 'orderExpired', bay: def.id });
      return true;
    case 'leaving':
      if (--bay.timer > 0) return false;
      bay.phase = 'empty';
      bay.timer = secondsToTicks(ORDERS.gapS);
      bay.item = null;
      bay.want = 0;
      bay.have = 0;
      return true;
  }
}

/**
 * Loads one item from a stack (the player's, or an employee's) onto the truck in this bay, if it's waiting
 * and wants it. Filling the order pays out and sends the truck off. Returns true if an item was loaded.
 */
export function loadOrder(
  def: BayDef,
  bay: BayState,
  state: GameState,
  events: SimEvent[],
  stack: ItemId[] = state.player.stack,
  from = 'player',
): boolean {
  if (bay.phase !== 'waiting' || !bay.item || bay.have >= bay.want) return false;
  const index = stack.lastIndexOf(bay.item);
  if (index < 0) return false;
  stack.splice(index, 1);
  bay.have++;
  events.push({ type: 'itemMoved', item: bay.item, from, to: def.id });
  if (bay.have >= bay.want) {
    const value = orderValue(bay);
    state.money += value;
    state.earned += value;
    events.push({ type: 'orderFilled', bay: def.id, item: bay.item, value });
    bay.phase = 'leaving';
    bay.timer = secondsToTicks(ORDERS.driveOutS);
  }
  return true;
}
