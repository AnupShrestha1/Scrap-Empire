// Gameplay numbers for Milestone 1. First guesses, tuned by playing (see docs/M1_PLAN.md §2).
import type { ItemId } from './items';

export const SUPPLIER = {
  item: 'scrap' as ItemId,
  /** Scrap per delivery. */
  load: 8,
  /** Seconds between one truck leaving and the next arriving. */
  intervalS: 20,
  /** The first truck of a new game comes quickly. */
  firstDeliveryS: 4,
  driveInS: 3,
  driveOutS: 3,
  /** Scrap moved from the truck to the pile per second. */
  unloadPerS: 4,
};

export const PILE = {
  capacity: 40,
  /** Scrap already waiting in a new game, so the player can start at once. */
  startItems: 10,
};

export const CARRY = {
  capacity: 5,
  /** Items moved per second while standing in a zone. */
  transferPerS: 8,
};

export interface ProcessorRecipe {
  input: ItemId;
  hopper: number;
  cycleS: number;
  /** Output tray capacity (all items together). */
  tray: number;
  /** Items produced per input. Fractions accumulate, so 0.3 means exactly 3 per 10 inputs. */
  outputs: Readonly<Partial<Record<ItemId, number>>>;
}

export const SHREDDER: ProcessorRecipe = {
  input: 'scrap',
  hopper: 10,
  cycleS: 2.5,
  tray: 12,
  outputs: { iron: 1, aluminium: 0.3 },
};

export const BINS = {
  capacity: 30,
};

export interface ManufacturerRecipe {
  /** Items pulled from the machine's feed bins for one batch. */
  inputs: Readonly<Partial<Record<ItemId, number>>>;
  /** Sold the moment it is made. */
  output: ItemId;
  batchS: number;
}

export const PRESS: ManufacturerRecipe = {
  inputs: { iron: 3 },
  output: 'sheet',
  batchS: 4,
};

export const CAN_LINE: ManufacturerRecipe = {
  inputs: { aluminium: 2 },
  output: 'can',
  batchS: 3,
};

export const BUILD_COSTS = {
  press: 120,
  canLine: 300,
} as const;

/** Cash per item when sold from a bin. */
export const PRICES: Readonly<Record<ItemId, number>> = {
  scrap: 0,
  iron: 2,
  aluminium: 5,
  sheet: 9,
  can: 15,
};

/** Items sold per second while standing on a sell pad. */
export const SELL_PER_S = 10;
