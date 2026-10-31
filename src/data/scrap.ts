// The kinds of scrap lying around the dump site. Small pieces are 1 scrap; big ones are worth 3 and fill
// 3 slots of the player's stack, so there's a choice about what to grab.

export interface PieceKind {
  id: string;
  /** Scrap the piece is worth, and stack slots it takes. */
  units: number;
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
];

export const SMALL_KINDS = PIECE_KINDS.map((k, i) => i).filter((i) => PIECE_KINDS[i]!.units === 1);
export const BIG_KINDS = PIECE_KINDS.map((k, i) => i).filter((i) => PIECE_KINDS[i]!.units > 1);
