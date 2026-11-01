/** Metals from the shredder, from common to rare (see docs/PROGRESSION.md §7). */
export const METALS = ['iron', 'aluminium', 'copper', 'titanium', 'gold', 'platinum'] as const;
export type MetalId = (typeof METALS)[number];

/** Products the factory lines make from metals (recipes in recipes.ts). */
export const PRODUCTS = [
  'sheet',
  'can',
  'toolbox',
  'wire',
  'motor',
  'radiator',
  'drillBit',
  'bikeFrame',
  'circuitBoard',
  'watch',
  'catalyst',
  'jetEngine',
] as const;
export type ProductId = (typeof PRODUCTS)[number];

export const ITEM_IDS = ['scrap', ...METALS, ...PRODUCTS] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && (ITEM_IDS as readonly string[]).includes(value);
}

export function isMetal(item: ItemId): item is MetalId {
  return (METALS as readonly string[]).includes(item);
}

export function isProduct(item: ItemId): item is ProductId {
  return (PRODUCTS as readonly string[]).includes(item);
}

/** A count of every item, all zero. */
export function emptyItemCounts(): Record<ItemId, number> {
  return Object.fromEntries(ITEM_IDS.map((id) => [id, 0])) as Record<ItemId, number>;
}
