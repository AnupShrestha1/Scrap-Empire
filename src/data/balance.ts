// Gameplay numbers. First guesses on the ×4 scale of docs/PROGRESSION.md, tuned with the balance bot.
import { METALS, PRODUCTS, type ItemId, type MetalId } from './items';
import { RECIPES } from './recipes';

export const SUPPLIER = {
  item: 'scrap' as ItemId,
  /** Scrap per delivery. */
  load: 10,
  /** Seconds between one truck leaving and the next arriving. */
  intervalS: 16,
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
}

export const SHREDDER: ProcessorRecipe & {
  /** The first few scraps of a game shred this fast, so the first metal appears almost at once. */
  warmCycleS: number;
  warmCount: number;
} = {
  input: 'scrap',
  hopper: 10,
  cycleS: 2.5,
  tray: 12,
  warmCycleS: 0.8,
  warmCount: 10,
};

/**
 * What each scrap gives (docs/PROGRESSION.md §7.1): always one iron, plus a separate roll for each rarer
 * metal that's unlocked. Aluminium arrives with business level 2; the rest with Extraction levels, and
 * every Extraction level past a metal's unlock makes it a little more likely.
 */
export interface MetalFind {
  /** Chance per scrap once unlocked (iron: amount per scrap). */
  chance: number;
  /** Added per Extraction level beyond the unlock. */
  perLevel: number;
  /** Unlocked by reaching this business level... */
  businessLevel?: number;
  /** ...or this Extraction level. */
  extraction?: number;
}

export const METAL_FINDS: Readonly<Record<MetalId, MetalFind>> = {
  iron: { chance: 1, perLevel: 0, businessLevel: 1 },
  aluminium: { chance: 0.3, perLevel: 0.04, businessLevel: 2 },
  copper: { chance: 0.15, perLevel: 0.025, extraction: 1 },
  titanium: { chance: 0.06, perLevel: 0.012, extraction: 3 },
  gold: { chance: 0.025, perLevel: 0.006, extraction: 5 },
  platinum: { chance: 0.01, perLevel: 0.0025, extraction: 7 },
};

export const BINS = {
  capacity: 30,
};

/** Finished products a factory line holds on its output spot before it pauses. */
export const LINE_OUTPUT = 8;

/** Employees, hired at the staff hut. */
export const STAFF = {
  /**
   * Price of each hire in turn; the length is the most that can be hired. The first is free: an early
   * objective sends the player to the hut to meet their first employee.
   */
  costs: [0, 500, 1000, 1800, 3000, 4500] as readonly number[],
  /** The hut opens at this business level. */
  requiresLevel: 2,
  /** Walking speed in tiles per second before Staff speed upgrades (the player walks 4.5). */
  speed: 2,
  /** Items an employee carries before Staff carry upgrades. */
  capacity: 2,
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
  /** The first truck of a game wants only this many. */
  firstAmount: 3,
  /** A filled order pays this times the base price. */
  bonus: 1.25,
};

/** Raw metal at the Scrap Dealer. */
const METAL_PRICES: Readonly<Record<MetalId, number>> = {
  iron: 8,
  aluminium: 20,
  copper: 36,
  titanium: 70,
  gold: 140,
  platinum: 300,
};

/** Cash per item: metals at the Scrap Dealer, products at the stall. Scrap isn't sold. */
export const PRICES: Readonly<Record<ItemId, number>> = {
  scrap: 0,
  ...METAL_PRICES,
  ...(Object.fromEntries(PRODUCTS.map((p) => [p, RECIPES[p].price])) as Record<(typeof PRODUCTS)[number], number>),
};

/** Every metal, in order: what the Scrap Dealer buys. */
export const RAW_METALS: readonly MetalId[] = METALS;

/** Items sold per second while standing on a sell pad. */
export const SELL_PER_S = 10;

/**
 * Lifetime earnings needed for each business level (index 0 is level 1). Levels unlock purchases, so new
 * options arrive at a steady pace instead of all at once.
 */
export const BUSINESS_LEVELS: readonly number[] = [0, 300, 800, 3000, 10000, 25000, 70000, 180000];

/** Business level (1-based) for lifetime earnings. */
export function businessLevel(earned: number): number {
  let level = 1;
  for (let i = 1; i < BUSINESS_LEVELS.length; i++) if (earned >= BUSINESS_LEVELS[i]!) level = i + 1;
  return level;
}
