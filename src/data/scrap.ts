// The kinds of scrap lying around the dump site. Small pieces are 1 scrap; big ones are worth 3 and fill
// 3 slots of the player's stack, so there's a choice about what to grab.

import { ITEM_IDS, type ItemId } from './items';

export interface PieceKind {
  id: string;
  /** Scrap the piece is worth, and stack slots it takes. */
  units: number;
  /** What picking it up gives; scrap unless it's something the player dropped. */
  item?: ItemId;
}

export const PIECE_KINDS: readonly PieceKind[] = [
  { id: 'can', units: 1 },
  { id: 'pipe', units: 1 },
  { id: 'gear', units: 1 },
  { id: 'plate', units: 1 },
  { id: 'tyre', units: 3 },
  { id: 'door', units: 3 },
  { id: 'fridge', units: 3 },
  { id: 'engine', units: 3 },
  // Things the player dropped with the Drop button, lying on the ground to be picked up again.
  { id: 'dropped-iron', units: 1, item: 'iron' },
  { id: 'dropped-aluminium', units: 1, item: 'aluminium' },
  { id: 'dropped-copper', units: 1, item: 'copper' },
  { id: 'dropped-sheet', units: 1, item: 'sheet' },
  { id: 'dropped-can', units: 1, item: 'can' },
  // Added with the six metals and twelve products; appended so older saves' piece kinds keep their index.
  ...ITEM_IDS.filter((item) => item !== 'scrap' && !['iron', 'aluminium', 'copper', 'sheet', 'can'].includes(item)).map(
    (item): PieceKind => ({ id: `dropped-${item}`, units: 1, item }),
  ),
];

/** What a piece gives when picked up. */
export function pieceItem(kind: number): ItemId {
  return PIECE_KINDS[kind]!.item ?? 'scrap';
}

/** The piece kind a dropped item becomes. */
export function droppedKind(item: ItemId): number {
  if (item === 'scrap') return SMALL_KINDS[0]!;
  const index = PIECE_KINDS.findIndex((k) => k.item === item);
  if (index < 0) throw new Error(`No dropped piece for ${item}`);
  return index;
}

/** Delivered scrap kinds (not dropped items). */
export const SMALL_KINDS = PIECE_KINDS.map((_k, i) => i).filter((i) => PIECE_KINDS[i]!.units === 1 && !PIECE_KINDS[i]!.item);
export const BIG_KINDS = PIECE_KINDS.map((_k, i) => i).filter((i) => PIECE_KINDS[i]!.units > 1);
