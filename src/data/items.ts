export const ITEM_IDS = ['scrap', 'iron', 'aluminium', 'copper', 'sheet', 'can'] as const;
export type ItemId = (typeof ITEM_IDS)[number];

export function isItemId(value: unknown): value is ItemId {
  return typeof value === 'string' && (ITEM_IDS as readonly string[]).includes(value);
}

/** A count of every item, all zero. */
export function emptyItemCounts(): Record<ItemId, number> {
  return { scrap: 0, iron: 0, aluminium: 0, copper: 0, sheet: 0, can: 0 };
}
