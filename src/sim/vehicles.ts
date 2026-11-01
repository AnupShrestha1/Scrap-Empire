// Where trucks are along their lanes, shared by the simulation (trucks block the player) and the view
// (which draws them there).

import { ORDERS, SUPPLIER } from '../data/balance';
import { TRUCK_ROUTE } from '../data/layout';
import { secondsToTicks, type BayState, type TruckState } from './state';
import type { BayDef, Rect } from './stations';

/** Half the width of a truck's body across its lane, in tiles. */
const HALF_WIDTH = 0.65;
/** Bay trucks are this long, in tiles. */
const BAY_TRUCK_LENGTH = 3;

/** The truck's rear x on its lane, eased while it drives in or out. `alpha` (0..1) interpolates between ticks. */
export function laneX(
  phase: string,
  timer: number,
  alpha: number,
  drive: { driveInS: number; driveOutS: number },
  startX: number,
  parkX: number,
): number {
  if (phase !== 'arriving' && phase !== 'leaving') return parkX;
  const ticks = secondsToTicks(phase === 'arriving' ? drive.driveInS : drive.driveOutS);
  const done = Math.min(1, Math.max(0, (ticks - timer + alpha) / ticks));
  const eased = done * done * (3 - 2 * done);
  return phase === 'arriving' ? startX + (parkX - startX) * eased : parkX + (startX - parkX) * eased;
}

export function supplierTruckX(truck: TruckState, alpha = 0): number {
  return laneX(truck.phase, truck.timer, alpha, SUPPLIER, TRUCK_ROUTE.startX, TRUCK_ROUTE.parkX);
}

export function bayTruckX(def: BayDef, bay: BayState, alpha = 0): number {
  return laneX(bay.phase, bay.timer, alpha, ORDERS, def.lane.startX, def.lane.parkX);
}

/** The supplier truck's centre line across its two-row road. */
export const SUPPLIER_TRUCK_Y = TRUCK_ROUTE.row + 1;

/** A bay truck's centre line, in the middle of its lane row. */
export function bayTruckY(def: BayDef): number {
  return def.lane.row + 0.5;
}

/** The ground every truck on the yard covers right now; solid to the player. */
export function truckRects(truck: TruckState, bays: readonly { def: BayDef; bay: BayState }[], out: Rect[] = []): Rect[] {
  out.length = 0;
  if (truck.phase !== 'away') {
    out.push({ x: supplierTruckX(truck), y: SUPPLIER_TRUCK_Y - HALF_WIDTH, w: TRUCK_ROUTE.length, h: HALF_WIDTH * 2 });
  }
  for (const { def, bay } of bays) {
    if (bay.phase === 'empty') continue;
    out.push({ x: bayTruckX(def, bay), y: bayTruckY(def) - HALF_WIDTH, w: BAY_TRUCK_LENGTH, h: HALF_WIDTH * 2 });
  }
  return out;
}
