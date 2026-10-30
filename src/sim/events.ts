import type { ItemId } from '../data/items';

export type ProcessorStatus = 'idle' | 'processing' | 'ready' | 'blocked';

/** Where an item moved from or to: a station id, the player or the truck. */
export type Place = string;
export const PLAYER_PLACE = 'player';
export const TRUCK_PLACE = 'truck';

/** Things that happened during a tick, for the view, sound and UI to react to. */
export type SimEvent =
  | { type: 'itemMoved'; item: ItemId; from: Place; to: Place }
  | { type: 'processorStatus'; station: string; status: ProcessorStatus }
  | { type: 'storageFull'; station: string; item: ItemId }
  | { type: 'sold'; station: string; item: ItemId; value: number }
  | { type: 'truckArriving' }
  | { type: 'truckWaiting' }
  | { type: 'truckLeaving' };
