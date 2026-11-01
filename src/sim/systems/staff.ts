// Employees: hired helpers who look for the most useful job they can see and do it. They carry items like
// the player but never spend money. Order of preference, when empty-handed:
//   1. take products a waiting truck wants from a factory line's output spot,
//   2. clear a line that's stuck (output full, or old products no truck wants) to sell at the stall,
//   3. clear a shredder's output tray: into the bins, or to the Scrap Dealer when the bins are full and the
//      tray is filling up (so a full bin never stops the shredder),
//   4. collect scrap from the dump site for a shredder with room.
// Holding something, they deliver it: products to a truck that wants them or else the stall, metal to its
// bin or else the Scrap Dealer, scrap to a shredder (collecting more first if their hands aren't full).
import { CARRY, PRICES, STAFF } from '../../data/balance';
import { isMetal, isProduct, ITEM_IDS, type ItemId } from '../../data/items';
import { LINE_OUTPUT } from '../../data/balance';
import { PIECE_KINDS, pieceItem } from '../../data/scrap';
import { SIM } from '../../config';
import { binCapacity, hopperCapacity, staffCapacity, staffSpeed, trayCapacity } from '../effective';
import type { SimEvent } from '../events';
import type { Grid } from '../grid';
import { findPath, nearestWalkableIn } from '../path';
import type { Employee, GameState } from '../state';
import type { BayDef, BinDef, DealerDef, DumpDef, FactoryDef, LineDef, OutletDef, ProcessorDef, Rect } from '../stations';
import type { Vec2 } from '../vec';
import { loadOrder } from './bays';
import { trayTotal } from './processing';

export type StaffTarget =
  | { kind: 'piece'; pieceId: number }
  | { kind: 'tray'; shredderId: string; overflow: boolean }
  | { kind: 'line'; lineId: string; bayId: string | null }
  | { kind: 'bay'; bayId: string }
  | { kind: 'bin'; binId: string }
  | { kind: 'hopper'; shredderId: string }
  | { kind: 'dealer' }
  | { kind: 'stall' };

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
  shredders: readonly ProcessorDef[];
  bins: readonly BinDef[];
  factories: readonly FactoryDef[];
  bays: readonly BayDef[];
  dealer?: DealerDef;
  outlet?: OutletDef;
}

const REACH = 0.35;

export function staffPlace(e: Employee): string {
  return `staff-${e.id}`;
}

function lines(world: StaffWorld): LineDef[] {
  return world.factories.flatMap((f) => [...f.lines]);
}

function builtShredders(world: StaffWorld, state: GameState): ProcessorDef[] {
  return world.shredders.filter((s) => state.processors[s.id]!.built);
}

/** Room left in a bin, counting what's already in it. */
function binRoom(state: GameState, bin: BinDef): number {
  return binCapacity(bin, state) - state.bins[bin.id]!.count;
}

function binFor(world: StaffWorld, item: ItemId): BinDef | undefined {
  return world.bins.find((b) => b.item === item);
}

/** A truck waiting for `item` that still needs some, if any. */
function truckWanting(world: StaffWorld, state: GameState, item: ItemId): BayDef | undefined {
  return world.bays.find((b) => {
    const s = state.bays[b.id]!;
    return s.phase === 'waiting' && s.item === item && s.have < s.want;
  });
}

/** A line whose products are stuck on its spot: output full, or from an old recipe, with no truck wanting them. */
function stuckLine(world: StaffWorld, state: GameState, line: LineDef): boolean {
  const st = state.lines[line.id]!;
  if (st.out === 0 || !st.outItem || truckWanting(world, state, st.outItem)) return false;
  return st.out >= LINE_OUTPUT || st.outItem !== st.product;
}

function claims(brains: ReadonlyMap<number, Brain>, self: number) {
  const pieces = new Set<number>();
  const lineBay = new Set<string>();
  const lineClear = new Set<string>();
  const trays = new Set<string>();
  for (const [id, b] of brains) {
    if (id === self || !b.target) continue;
    const t = b.target;
    if (t.kind === 'piece') pieces.add(t.pieceId);
    if (t.kind === 'tray') trays.add(t.shredderId);
    if (t.kind === 'line') (t.bayId ? lineBay.add(t.bayId) : lineClear.add(t.lineId));
  }
  return { pieces, lineBay, lineClear, trays };
}

/** The best job for this employee right now, or null. */
function chooseTarget(e: Employee, state: GameState, world: StaffWorld, brains: ReadonlyMap<number, Brain>): StaffTarget | null {
  const taken = claims(brains, e.id);
  const room = staffCapacity(state) - e.stack.length;
  const shredders = builtShredders(world, state);
  const hopperRoom = (s: ProcessorDef) => hopperCapacity(s, state) - state.processors[s.id]!.hopper;
  const roomiest = () => shredders.reduce<ProcessorDef | undefined>((best, s) => (hopperRoom(s) > (best ? hopperRoom(best) : 0) ? s : best), undefined);

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
      if (isProduct(item)) {
        const bay = truckWanting(world, state, item);
        if (bay) return { kind: 'bay', bayId: bay.id };
        if (world.outlet) return { kind: 'stall' };
      } else if (isMetal(item)) {
        const bin = binFor(world, item);
        if (bin && binRoom(state, bin) > 0) return { kind: 'bin', binId: bin.id };
        if (world.dealer) return { kind: 'dealer' };
      }
    }
    if (e.stack.every((i) => i === 'scrap')) {
      const target = roomiest();
      const space = target ? hopperRoom(target) : 0;
      const more = room > 0 && space > e.stack.length ? nearestPiece() : undefined;
      if (more) return { kind: 'piece', pieceId: more.id };
      if (target && space > 0) return { kind: 'hopper', shredderId: target.id };
    }
    return null;
  }

  // Empty-handed: trucks first, then stuck lines, then the shredders' trays, then scrap for them.
  for (const b of world.bays) {
    const bay = state.bays[b.id]!;
    if (bay.phase !== 'waiting' || !bay.item || bay.have >= bay.want || taken.lineBay.has(b.id)) continue;
    const line = lines(world).find((l) => state.lines[l.id]!.outItem === bay.item && state.lines[l.id]!.out > 0);
    if (line) return { kind: 'line', lineId: line.id, bayId: b.id };
  }
  if (world.outlet) {
    const stuck = lines(world).find((l) => !taken.lineClear.has(l.id) && stuckLine(world, state, l));
    if (stuck) return { kind: 'line', lineId: stuck.id, bayId: null };
  }
  for (const s of shredders) {
    if (taken.trays.has(s.id)) continue;
    const machine = state.processors[s.id]!;
    const tray = machine.tray;
    const storable = ITEM_IDS.some((item) => tray[item] > 0 && binFor(world, item) && binRoom(state, binFor(world, item)!) > 0);
    if (storable) return { kind: 'tray', shredderId: s.id, overflow: false };
    // The bins are full: once the tray is nearly full too, sell its metal rather than let the shredder stop.
    const nearlyFull = trayTotal(machine) >= trayCapacity(s, state) - 2;
    if (nearlyFull && world.dealer) return { kind: 'tray', shredderId: s.id, overflow: true };
  }
  const target = roomiest();
  if (target && hopperRoom(target) > 0) {
    const piece = nearestPiece();
    if (piece) return { kind: 'piece', pieceId: piece.id };
  }
  return null;
}

/** Where to walk for a target. */
function destination(e: Employee, target: StaffTarget, state: GameState, world: StaffWorld): Vec2 | undefined {
  const zone = (r: Rect) => nearestWalkableIn(world.grid, r, e);
  const shredder = (id: string) => world.shredders.find((s) => s.id === id)!;
  switch (target.kind) {
    case 'piece': {
      const p = state.field.pieces.find((q) => q.id === target.pieceId);
      return p ? { x: p.x, y: p.y } : undefined;
    }
    case 'tray':
      return zone(shredder(target.shredderId).zones.output);
    case 'hopper':
      return zone(shredder(target.shredderId).zones.input);
    case 'line':
      return zone(lines(world).find((l) => l.id === target.lineId)!.output);
    case 'bay':
      return zone(world.bays.find((b) => b.id === target.bayId)!.zones.load);
    case 'bin':
      return zone(world.bins.find((b) => b.id === target.binId)!.zones.deposit);
    case 'dealer':
      return world.dealer && zone(world.dealer.zones.sell);
    case 'stall':
      return world.outlet && zone(world.outlet.zones.sell);
  }
}

/** Whether a target still makes sense (e.g. the piece wasn't taken, the truck didn't leave). */
function stillValid(target: StaffTarget, state: GameState): boolean {
  switch (target.kind) {
    case 'piece':
      return state.field.pieces.some((p) => p.id === target.pieceId);
    case 'bay':
      return state.bays[target.bayId]!.phase === 'waiting' && state.bays[target.bayId]!.have < state.bays[target.bayId]!.want;
    case 'line': {
      if (!target.bayId) return true;
      const bay = state.bays[target.bayId]!;
      return bay.phase === 'waiting' && bay.have < bay.want;
    }
    default:
      return true;
  }
}

/** Sells one item matching `wanted` from the employee's hands, at its price. */
function sellOne(e: Employee, state: GameState, events: SimEvent[], station: string, wanted: (i: ItemId) => boolean): 'more' | 'done' {
  let index = e.stack.length - 1;
  while (index >= 0 && !wanted(e.stack[index]!)) index--;
  if (index < 0) return 'done';
  const item = e.stack[index]!;
  e.stack.splice(index, 1);
  state.money += PRICES[item];
  state.earned += PRICES[item];
  events.push({ type: 'sold', station, item, value: PRICES[item] });
  return 'more';
}

/**
 * Does one item's worth of the job at the destination. Returns 'more' to keep going, 'done' when the job
 * is finished.
 */
function act(e: Employee, target: StaffTarget, state: GameState, world: StaffWorld, events: SimEvent[]): 'more' | 'done' {
  const place = staffPlace(e);
  const room = staffCapacity(state) - e.stack.length;
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
      const tray = state.processors[target.shredderId]!.tray;
      if (room <= 0) return 'done';
      const item = ITEM_IDS.find((i) => {
        if (tray[i] === 0) return false;
        if (target.overflow) return true;
        const bin = binFor(world, i);
        const carried = e.stack.filter((s) => s === i).length;
        return !!bin && binRoom(state, bin) > carried;
      });
      if (!item) return 'done';
      tray[item]--;
      e.stack.push(item);
      events.push({ type: 'itemMoved', item, from: target.shredderId, to: place });
      return 'more';
    }
    case 'line': {
      const st = state.lines[target.lineId]!;
      const item = st.outItem;
      if (!item || st.out === 0 || room <= 0) return 'done';
      if (target.bayId) {
        const bay = state.bays[target.bayId]!;
        const carried = e.stack.filter((s) => s === item).length;
        if (item !== bay.item || carried >= bay.want - bay.have) return 'done';
      }
      st.out--;
      if (st.out === 0) st.outItem = null;
      e.stack.push(item);
      events.push({ type: 'itemMoved', item, from: target.lineId, to: place });
      return 'more';
    }
    case 'bay': {
      const def = world.bays.find((b) => b.id === target.bayId)!;
      return loadOrder(def, state.bays[def.id]!, state, events, e.stack, place) ? 'more' : 'done';
    }
    case 'bin': {
      const bin = world.bins.find((b) => b.id === target.binId)!;
      const index = e.stack.lastIndexOf(bin.item);
      if (index < 0 || binRoom(state, bin) <= 0) return 'done';
      e.stack.splice(index, 1);
      state.bins[bin.id]!.count++;
      events.push({ type: 'itemMoved', item: bin.item, from: place, to: bin.id });
      return 'more';
    }
    case 'hopper': {
      const def = world.shredders.find((s) => s.id === target.shredderId)!;
      const machine = state.processors[def.id]!;
      const index = e.stack.lastIndexOf('scrap');
      if (index < 0 || machine.hopper >= hopperCapacity(def, state)) return 'done';
      e.stack.splice(index, 1);
      machine.hopper++;
      events.push({ type: 'itemMoved', item: 'scrap', from: place, to: def.id });
      return 'more';
    }
    case 'dealer':
      // Only metal whose bin is full (or that has no bin) is sold; the rest goes on to storage.
      return world.dealer
        ? sellOne(e, state, events, world.dealer.id, (i) => isMetal(i) && !(binFor(world, i) && binRoom(state, binFor(world, i)!) > 0))
        : 'done';
    case 'stall':
      return world.outlet ? sellOne(e, state, events, world.outlet.id, (i) => isProduct(i) && !truckWanting(world, state, i)) : 'done';
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
    let step = staffSpeed(state) * dt;
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
