import { FIELD } from '../../data/balance';
import { BIG_KINDS, droppedKind, PIECE_KINDS, pieceItem, SMALL_KINDS } from '../../data/scrap';
import { boxHitsSolid, type Grid } from '../grid';
import { carryCapacity, magnetRadius } from '../effective';
import { PLAYER_PLACE, type SimEvent } from '../events';
import type { FieldPiece, FieldState, GameState } from '../state';
import type { DumpDef, Rect } from '../stations';

/** Next number from the field's own seeded generator (mulberry32), so scatter is reproducible. */
export function nextRandom(field: FieldState): number {
  field.seed = (field.seed + 0x6d2b79f5) >>> 0;
  let t = field.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Drops a piece of `kind` at a random spot in `rect`. */
export function scatterPiece(field: FieldState, rect: Rect, kind: number): FieldPiece {
  const inset = 0.4;
  const piece: FieldPiece = {
    id: field.nextId++,
    x: rect.x + inset + nextRandom(field) * (rect.w - inset * 2),
    y: rect.y + inset + nextRandom(field) * (rect.h - inset * 2),
    kind,
  };
  field.pieces.push(piece);
  return piece;
}

/** Picks a piece kind worth at most `units`: big pieces some of the time, small ones otherwise. */
export function randomKind(field: FieldState, units: number): number {
  const pick = (list: readonly number[]) => list[Math.floor(nextRandom(field) * list.length)]!;
  if (units >= 3 && nextRandom(field) < FIELD.bigChance) return pick(BIG_KINDS);
  return pick(SMALL_KINDS);
}

export function fieldUnits(field: FieldState): number {
  let units = 0;
  for (const p of field.pieces) units += PIECE_KINDS[p.kind]!.units;
  return units;
}

/**
 * Collecting: pieces near the player slide towards them (the magnet) and are picked up within reach,
 * as long as the stack has room for the whole piece. Returns true if anything changed.
 */
export function stepField(state: GameState, dump: DumpDef, dt: number, events: SimEvent[]): boolean {
  const { player, field } = state;
  const magnet = magnetRadius(state);
  let room = carryCapacity(state) - player.stack.length;
  if (room <= 0) return false;
  let changed = false;

  for (let i = field.pieces.length - 1; i >= 0; i--) {
    const piece = field.pieces[i]!;
    const dx = player.x - piece.x;
    const dy = player.y - piece.y;
    if (piece.locked) {
      // Dropped things unlock once the player has walked out of reach.
      if (Math.hypot(dx, dy) > magnet + 0.2) delete piece.locked;
      continue;
    }
    if (Math.abs(dx) > magnet || Math.abs(dy) > magnet) continue;
    const distance = Math.hypot(dx, dy);
    if (distance > magnet) continue;
    const units = PIECE_KINDS[piece.kind]!.units;
    if (units > room) continue;

    if (distance <= FIELD.pickupRadius) {
      field.pieces.splice(i, 1);
      const item = pieceItem(piece.kind);
      for (let u = 0; u < units; u++) player.stack.push(item);
      room -= units;
      for (let u = 0; u < units; u++) events.push({ type: 'itemMoved', item, from: dump.id, to: PLAYER_PLACE });
      events.push({ type: 'pickedUp', kind: piece.kind, units, x: piece.x, y: piece.y });
      changed = true;
      if (room <= 0) break;
      continue;
    }
    const step = Math.min(distance, FIELD.pullSpeed * dt);
    piece.x += (dx / distance) * step;
    piece.y += (dy / distance) * step;
    changed = true;
  }
  return changed;
}

/**
 * The Drop button: everything the player carries lands on the ground around their feet, where it can be
 * picked up again after a moment. Pieces never land inside anything solid. Returns true if anything dropped.
 */
export function dropStack(state: GameState, grid: Grid, events: SimEvent[]): boolean {
  const { player, field } = state;
  const count = player.stack.length;
  if (count === 0) return false;
  for (const item of player.stack) {
    let x = player.x;
    let y = player.y;
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = nextRandom(field) * Math.PI * 2;
      const r = FIELD.dropSpread * (0.4 + 0.6 * nextRandom(field));
      const cx = player.x + Math.cos(angle) * r;
      const cy = player.y + Math.sin(angle) * r;
      if (!boxHitsSolid(grid, cx - 0.1, cy - 0.1, cx + 0.1, cy + 0.1)) {
        x = cx;
        y = cy;
        break;
      }
    }
    field.pieces.push({ id: field.nextId++, x, y, kind: droppedKind(item), locked: true });
  }
  player.stack = [];
  events.push({ type: 'dropped', count });
  return true;
}
