import { SUPPLIER } from '../../data/balance';
import { TRUCK_PLACE, type SimEvent } from '../events';
import { secondsToTicks, type PileState, type TruckState } from '../state';
import type { PileDef } from '../stations';

/**
 * The supplier truck: arrives on a timer, unloads scrap onto the pile item by item, waits at the
 * gate if the pile is full, then leaves. Returns true if anything changed besides timers.
 */
export function stepSupplier(truck: TruckState, pileDef: PileDef, pile: PileState, events: SimEvent[]): boolean {
  switch (truck.phase) {
    case 'away':
      if (--truck.timer > 0) return false;
      truck.phase = 'arriving';
      truck.timer = secondsToTicks(SUPPLIER.driveInS);
      truck.load = SUPPLIER.load;
      events.push({ type: 'truckArriving' });
      return true;

    case 'arriving':
      if (--truck.timer > 0) return false;
      truck.phase = 'unloading';
      truck.timer = secondsToTicks(1 / SUPPLIER.unloadPerS);
      return true;

    case 'unloading':
      if (truck.load === 0) {
        truck.phase = 'leaving';
        truck.timer = secondsToTicks(SUPPLIER.driveOutS);
        events.push({ type: 'truckLeaving' });
        return true;
      }
      if (--truck.timer > 0) return false;
      if (pile.items >= pileDef.capacity) {
        truck.phase = 'waiting';
        events.push({ type: 'truckWaiting' });
        return true;
      }
      pile.items++;
      truck.load--;
      truck.timer = secondsToTicks(1 / SUPPLIER.unloadPerS);
      events.push({ type: 'itemMoved', item: SUPPLIER.item, from: TRUCK_PLACE, to: pileDef.id });
      return true;

    case 'waiting':
      if (pile.items >= pileDef.capacity) return false;
      truck.phase = 'unloading';
      truck.timer = 1;
      return true;

    case 'leaving':
      if (--truck.timer > 0) return false;
      truck.phase = 'away';
      truck.timer = secondsToTicks(SUPPLIER.intervalS);
      return true;
  }
}
