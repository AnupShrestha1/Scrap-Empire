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
  /** Pieces tipped from the truck onto the field per second. */
  unloadPerS: 5,
};

/** The dump site, where scrap lies scattered for the player to collect. */
export const FIELD = {
  /** Most pieces on the field; the truck waits at the gate while it's full. */
  capacity: 150,
  /** Scrap units scattered on the field in a new game, so the player can start at once. */
  startUnits: 12,
  /** Within this distance (tiles) the player picks a piece up. */
  pickupRadius: 0.45,
  /** Within this distance pieces slide towards the player; the Magnet upgrade widens it. */
  magnetRadius: 1.1,
  /** How fast pulled pieces slide, in tiles per second. */
  pullSpeed: 6,
  /** Chance a delivered piece is a big one (worth 3), when the load has room for it. */
  bigChance: 0.25,
  /** Dropped items land within this distance of the player. */
  dropSpread: 0.6,
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

/**
 * Testing switch (the user asked for it): every scrap splits equally into iron, aluminium and copper, so all
 * three materials show up from the start. Set to false for the normal mix (copper then comes from Extraction).
 */
export const EQUAL_SHREDDER_OUTPUTS = true;

const NORMAL_SHREDDER_OUTPUTS = { iron: 1, aluminium: 0.3 };
const EQUAL_SHARE = 1 / 3;
const EQUAL_OUTPUTS = { iron: EQUAL_SHARE, aluminium: EQUAL_SHARE, copper: EQUAL_SHARE };

export const SHREDDER: ProcessorRecipe = {
  input: 'scrap',
  hopper: 10,
  cycleS: 2.5,
  tray: 12,
  outputs: EQUAL_SHREDDER_OUTPUTS ? EQUAL_OUTPUTS : NORMAL_SHREDDER_OUTPUTS,
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

/** Finished products a factory line holds on its output spot before it pauses. */
export const LINE_OUTPUT = 8;

/** Employees, hired at the staff hut. */
export const STAFF = {
  /** Price of each hire in turn; the length is the most that can be hired. */
  costs: [150, 250, 400, 600, 850, 1150] as readonly number[],
  /** Walking speed in tiles per second (a little slower than the player). */
  speed: 3.6,
  /** Items an employee carries. */
  capacity: 5,
  /** How often an employee with nothing to do looks again. */
  thinkEveryTicks: 10,
};

/** Buyer trucks at the loading bay. */
export const ORDERS = {
  /** Seconds between one truck leaving a bay and the next arriving. */
  gapS: 6,
  driveInS: 3,
  driveOutS: 3,
  /** How long a truck waits to be loaded before leaving without paying. */
  patienceS: 90,
  minAmount: 4,
  maxAmount: 8,
  /** A filled order pays this times the base price. */
  bonus: 1.25,
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
  /** Sold raw until the wire drawer arrives (M4). */
  copper: 8,
  sheet: 9,
  can: 15,
};

/** Items sold per second while standing on a sell pad. */
export const SELL_PER_S = 10;

/**
 * Lifetime earnings needed for each business level (index 0 is level 1). Levels unlock purchases, so new
 * options arrive at a steady pace instead of all at once.
 */
export const BUSINESS_LEVELS: readonly number[] = [0, 150, 500, 1500, 4000, 10000];

/** Business level (1-based) for lifetime earnings. */
export function businessLevel(earned: number): number {
  let level = 1;
  for (let i = 1; i < BUSINESS_LEVELS.length; i++) if (earned >= BUSINESS_LEVELS[i]!) level = i + 1;
  return level;
}
