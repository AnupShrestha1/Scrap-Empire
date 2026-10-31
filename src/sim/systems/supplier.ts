import { SUPPLIER } from '../../data/balance';
import { supplyIntervalS, supplyLoad } from '../effective';
import { TRUCK_PLACE, type SimEvent } from '../events';
import { PIECE_KINDS } from '../../data/scrap';
import { secondsToTicks, type GameState } from '../state';
import type { DumpDef } from '../stations';
import { randomKind, scatterPiece } from './field';

/**
 * The supplier truck: arrives on a timer, tips its load onto the dump site piece by piece (they scatter
 * across the field), waits if the field is full, then leaves. Returns true if anything changed.
 */
export function stepSupplier(state: GameState, dump: DumpDef, events: SimEvent[]): boolean {
  const truck = state.truck;
  const field = state.field;
  switch (truck.phase) {
    case 'away':
      if (--truck.timer > 0) return false;
      truck.phase = 'arriving';
      truck.timer = secondsToTicks(SUPPLIER.driveInS);
      truck.load = supplyLoad(state);
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
      if (field.pieces.length >= dump.capacity) {
        truck.phase = 'waiting';
        events.push({ type: 'truckWaiting' });
        return true;
      }
      {
        const kind = randomKind(field, truck.load);
        scatterPiece(field, dump.zones.field, kind);
        truck.load = Math.max(0, truck.load - PIECE_KINDS[kind]!.units);
      }
      truck.timer = secondsToTicks(1 / SUPPLIER.unloadPerS);
      events.push({ type: 'itemMoved', item: SUPPLIER.item, from: TRUCK_PLACE, to: dump.id });
      return true;

    case 'waiting':
      if (field.pieces.length >= dump.capacity) return false;
      truck.phase = 'unloading';
      truck.timer = 1;
      return true;

    case 'leaving':
      if (--truck.timer > 0) return false;
      truck.phase = 'away';
      truck.timer = secondsToTicks(supplyIntervalS(state));
      return true;
  }
}
