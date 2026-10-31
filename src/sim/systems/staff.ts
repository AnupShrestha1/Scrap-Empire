// Employees: hired helpers who look for the most useful job they can see and do it. They carry items like
// the player but never spend money or sell. Order of preference, when empty-handed:
//   1. take products a waiting truck wants from a factory line's output spot,
//   2. clear the shredder's output tray (only what the bins have room for),
//   3. collect scrap from the dump site for the shredder.
// Holding something, they deliver it: products to a truck that wants them, metal to its bin, scrap to the
// shredder (collecting more first if their hands aren't full yet).
import { CARRY, STAFF } from '../../data/balance';
import { ITEM_IDS, type ItemId } from '../../data/items';
import { PIECE_KINDS, pieceItem } from '../../data/scrap';
import { SIM } from '../../config';
import { binCapacity } from '../effective';
import type { SimEvent } from '../events';
import type { Grid } from '../grid';
import { findPath, nearestWalkableIn } from '../path';
import type { Employee, GameState } from '../state';
import type { BayDef, BinDef, DumpDef, FactoryDef, LineDef, ProcessorDef, Rect } from '../stations';
import type { Vec2 } from '../vec';
import { loadOrder } from './bays';

export type StaffTarget =
  | { kind: 'piece'; pieceId: number }
  | { kind: 'tray' }
  | { kind: 'line'; lineId: string; bayId: string }
  | { kind: 'bay'; bayId: string }
  | { kind: 'bin'; binId: string }
  | { kind: 'hopper' };

/** Per-employee plans; not saved (rebuilt after a load). */
export interface Brain {
  target: StaffTarget | null;
  path: Vec2[];
  budget: number;
  /** Ticks to wait before looking for work again after finding none. */
  rest: number;
}

export interface StaffWorld {
  grid: Grid;
  dump: DumpDef;
  shredder: ProcessorDef;
  bins: readonly BinDef[];
  factories: readonly FactoryDef[];
  bays: readonly BayDef[];
}

const PRODUCTS: ReadonlySet<ItemId> = new Set(['sheet', 'can']);
const REACH = 0.35;

export function staffPlace(e: Employee): string {
  return `staff-${e.id}`;
}

function lines(world: StaffWorld): LineDef[] {
  return world.factories.flatMap((f) => [...f.lines]);
}

/** Room left in a bin, counting what's already in it. */
function binRoom(world: StaffWorld, state: GameState, bin: BinDef): number {
  return binCapacity(bin, state) - state.bins[bin.id]!.count;
}

function claims(brains: ReadonlyMap<number, Brain>, self: number) {
  const pieces = new Set<number>();
  const lineBay = new Set<string>();
  let tray = false;
  for (const [id, b] of brains) {
    if (id === self || !b.target) continue;
    if (b.target.kind === 'piece') pieces.add(b.target.pieceId);
    if (b.target.kind === 'tray') tray = true;
    if (b.target.kind === 'line') lineBay.add(b.target.bayId);
  }
  return { pieces, lineBay, tray };
}

/** The best job for this employee right now, or null. */
function chooseTarget(e: Employee, state: GameState, world: StaffWorld, brains: ReadonlyMap<number, Brain>): StaffTarget | null {
  const taken = claims(brains, e.id);
  const room = STAFF.capacity - e.stack.length;
  const hopper = state.processors[world.shredder.id]!;
  const hopperRoom = world.shredder.recipe.hopper - hopper.hopper;

  const nearestPiece = () => {
    let best: { id: number; d: number } | undefined;
    for (const p of state.field.pieces) {
      if (taken.pieces.has(p.id) || p.locked) continue;
      if (pieceItem(p.kind) !== 'scrap' || PIECE_KINDS[p.kind]!.units > room) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (!best || d < best.d) best = { id: p.id, d };
    }
    return best;
  };

  if (e.stack.length > 0) {
    for (const item of new Set(e.stack)) {
      if (PRODUCTS.has(item)) {
        const bay = world.bays.find((b) => {
          const s = state.bays[b.id]!;
          return s.phase === 'waiting' && s.item === item && s.have < s.want;
        });
        if (bay) return { kind: 'bay', bayId: bay.id };
      } else if (item !== 'scrap') {
        const bin = world.bins.find((b) => b.item === item && binRoom(world, state, b) > 0);
        if (bin) return { kind: 'bin', binId: bin.id };
      }
    }
    if (e.stack.every((i) => i === 'scrap')) {
      const more = room > 0 && hopperRoom > e.stack.length ? nearestPiece() : undefined;
      if (more) return { kind: 'piece', pieceId: more.id };
      if (hopperRoom > 0) return { kind: 'hopper' };
    }
    return null;
  }

  // Empty-handed: trucks first, then the shredder's tray, then scrap for the shredder.
  for (const b of world.bays) {
    const bay = state.bays[b.id]!;
    if (bay.phase !== 'waiting' || !bay.item || bay.have >= bay.want || taken.lineBay.has(b.id)) continue;
    const line = lines(world).find((l) => l.recipe.output === bay.item && state.lines[l.id]!.out > 0);
    if (line) return { kind: 'line', lineId: line.id, bayId: b.id };
  }
  if (!taken.tray) {
    const tray = state.processors[world.shredder.id]!.tray;
    const useful = ITEM_IDS.some((item) => tray[item] > 0 && world.bins.some((b) => b.item === item && binRoom(world, state, b) > 0));
    if (useful) return { kind: 'tray' };
  }
  if (hopperRoom > 0) {
    const piece = nearestPiece();
    if (piece) return { kind: 'piece', pieceId: piece.id };
  }
  return null;
}

/** Where to walk for a target. */
function destination(e: Employee, target: StaffTarget, state: GameState, world: StaffWorld): Vec2 | undefined {
  const zone = (r: Rect) => nearestWalkableIn(world.grid, r, e);
  switch (target.kind) {
    case 'piece': {
      const p = state.field.pieces.find((q) => q.id === target.pieceId);
      return p ? { x: p.x, y: p.y } : undefined;
    }
    case 'tray':
      return zone(world.shredder.zones.output);
    case 'hopper':
      return zone(world.shredder.zones.input);
    case 'line':
      return zone(lines(world).find((l) => l.id === target.lineId)!.output);
    case 'bay':
      return zone(world.bays.find((b) => b.id === target.bayId)!.zones.load);
    case 'bin':
      return zone(world.bins.find((b) => b.id === target.binId)!.zones.deposit);
  }
}

/** Whether a target still makes sense (e.g. the piece wasn't taken, the truck didn't leave). */
function stillValid(target: StaffTarget, state: GameState): boolean {
  switch (target.kind) {
    case 'piece':
      return state.field.pieces.some((p) => p.id === target.pieceId);
    case 'line':
    case 'bay': {
      const bay = state.bays[target.bayId]!;
      return bay.phase === 'waiting' && bay.have < bay.want;
    }
    default:
      return true;
  }
}

/**
 * Does one item's worth of the job at the destination. Returns 'more' to keep going, 'done' when the job
 * is finished.
 */
function act(e: Employee, target: StaffTarget, state: GameState, world: StaffWorld, events: SimEvent[]): 'more' | 'done' {
  const place = staffPlace(e);
  const room = STAFF.capacity - e.stack.length;
  switch (target.kind) {
    case 'piece': {
      const i = state.field.pieces.findIndex((p) => p.id === target.pieceId);
      if (i < 0) return 'done';
      const piece = state.field.pieces[i]!;
      const units = PIECE_KINDS[piece.kind]!.units;
      if (units > room) return 'done';
      state.field.pieces.splice(i, 1);
      for (let u = 0; u < units; u++) e.stack.push('scrap');
      for (let u = 0; u < units; u++) events.push({ type: 'itemMoved', item: 'scrap', from: world.dump.id, to: place });
      return 'done';
    }
    case 'tray': {
      const tray = state.processors[world.shredder.id]!.tray;
      if (room <= 0) return 'done';
      const item = ITEM_IDS.find((i) => {
        if (tray[i] === 0) return false;
        const bin = world.bins.find((b) => b.item === i);
        const carried = e.stack.filter((s) => s === i).length;
        return !!bin && binRoom(world, state, bin) > carried;
      });
      if (!item) return 'done';
      tray[item]--;
      e.stack.push(item);
      events.push({ type: 'itemMoved', item, from: world.shredder.id, to: place });
      return 'more';
    }
    case 'line': {
      const line = lines(world).find((l) => l.id === target.lineId)!;
      const bay = state.bays[target.bayId]!;
      const st = state.lines[line.id]!;
      const carried = e.stack.filter((s) => s === line.recipe.output).length;
      if (room <= 0 || st.out === 0 || carried >= bay.want - bay.have) return 'done';
      st.out--;
      e.stack.push(line.recipe.output);
      events.push({ type: 'itemMoved', item: line.recipe.output, from: line.id, to: place });
      return 'more';
    }
    case 'bay': {
      const def = world.bays.find((b) => b.id === target.bayId)!;
      return loadOrder(def, state.bays[def.id]!, state, events, e.stack, place) ? 'more' : 'done';
    }
    case 'bin': {
      const bin = world.bins.find((b) => b.id === target.binId)!;
      const index = e.stack.lastIndexOf(bin.item);
      if (index < 0 || binRoom(world, state, bin) <= 0) return 'done';
      e.stack.splice(index, 1);
      state.bins[bin.id]!.count++;
      events.push({ type: 'itemMoved', item: bin.item, from: place, to: bin.id });
      return 'more';
    }
    case 'hopper': {
      const machine = state.processors[world.shredder.id]!;
      const index = e.stack.lastIndexOf('scrap');
      if (index < 0 || machine.hopper >= world.shredder.recipe.hopper) return 'done';
      e.stack.splice(index, 1);
      machine.hopper++;
      events.push({ type: 'itemMoved', item: 'scrap', from: place, to: world.shredder.id });
      return 'more';
    }
  }
}

/** One tick for every employee: think if idle, walk the route, then work at the destination. */
export function stepStaff(state: GameState, world: StaffWorld, brains: Map<number, Brain>, events: SimEvent[]): boolean {
  let changed = false;
  const dt = 1 / SIM.tickRate;
  for (const e of state.employees) {
    let brain = brains.get(e.id);
    if (!brain) {
      brain = { target: null, path: [], budget: 0, rest: 0 };
      brains.set(e.id, brain);
    }
    if (brain.target && !stillValid(brain.target, state)) {
      brain.target = null;
      brain.path = [];
    }
    if (!brain.target) {
      if (brain.rest > 0) {
        brain.rest--;
        continue;
      }
      const target = chooseTarget(e, state, world, brains);
      const to = target && destination(e, target, state, world);
      const path = to && findPath(world.grid, e, to);
      if (!target || !path) {
        brain.rest = STAFF.thinkEveryTicks;
        continue;
      }
      brain.target = target;
      brain.path = path;
      brain.budget = 1;
    }

    // Walk.
    let step = STAFF.speed * dt;
    while (step > 0 && brain.path.length > 0) {
      const next = brain.path[0]!;
      const dx = next.x - e.x;
      const dy = next.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-6) e.facing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      if (d <= step) {
        e.x = next.x;
        e.y = next.y;
        brain.path.shift();
        step -= d;
      } else {
        e.x += (dx / d) * step;
        e.y += (dy / d) * step;
        step = 0;
      }
      changed = true;
    }
    if (brain.path.length > 0) continue;

    // Work at the destination, at the same rate the player moves items.
    if (brain.target.kind === 'piece') {
      const piece = state.field.pieces.find((p) => p.id === (brain!.target as { pieceId: number }).pieceId);
      if (piece && Math.hypot(piece.x - e.x, piece.y - e.y) > REACH) {
        brain.path = [{ x: piece.x, y: piece.y }];
        continue;
      }
    }
    brain.budget = Math.min(1, brain.budget + CARRY.transferPerS / SIM.tickRate);
    if (brain.budget < 1) continue;
    brain.budget -= 1;
    if (act(e, brain.target, state, world, events) === 'done') {
      brain.target = null;
      brain.path = [];
    }
    changed = true;
  }
  return changed;
}
