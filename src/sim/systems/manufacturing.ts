import { LINE_OUTPUT } from '../../data/balance';
import { isProduct, type MetalId, type ProductId } from '../../data/items';
import { RECIPES, recipeMetals } from '../../data/recipes';
import { lineBatchTicks, productUnlocked } from '../effective';
import type { SimEvent } from '../events';
import type { BinState, GameState, LineState } from '../state';
import type { BinDef, FactoryDef, LineDef } from '../stations';

export type LineStatus = 'unbuilt' | 'idle' | 'starved' | 'processing' | 'blocked';

/** Batch time for what the line is making, after the line speed upgrade. */
export function batchTicks(factory: FactoryDef, st: LineState, state: GameState): number {
  return lineBatchTicks(factory, st.product, state);
}

/** The bin that stores a metal. */
export function binFor(binDefs: ReadonlyMap<string, BinDef>, metal: MetalId): BinDef | undefined {
  for (const bin of binDefs.values()) if (bin.item === metal) return bin;
  return undefined;
}

/** The first metal the bins can't cover for a batch of `product`, if any. */
export function missingInput(
  product: ProductId,
  binDefs: ReadonlyMap<string, BinDef>,
  bins: Readonly<Record<string, BinState>>,
): MetalId | undefined {
  for (const metal of recipeMetals(product)) {
    const bin = binFor(binDefs, metal);
    if (!bin || bins[bin.id]!.count < RECIPES[product].inputs[metal]!) return metal;
  }
  return undefined;
}

/** The next line slot the factory's build pad sells, in layout order. */
export function nextUnbuiltLine(factory: FactoryDef, state: GameState): LineDef | undefined {
  return factory.lines.find((line) => !state.lines[line.id]?.built);
}

/** Products from an earlier recipe still on the output spot hold the line until they're collected. */
function holdingOldProducts(st: LineState): boolean {
  return st.out > 0 && st.outItem !== null && st.outItem !== st.product;
}

/**
 * One tick of a production line: when idle with room on its output spot, pull a batch of metals straight
 * from the bins; when the batch time is up, the product lands on the output spot to be collected.
 * Returns true if anything changed.
 */
export function stepLine(
  factory: FactoryDef,
  line: LineDef,
  st: LineState,
  binDefs: ReadonlyMap<string, BinDef>,
  state: GameState,
  events: SimEvent[],
): boolean {
  if (!st.built) return false;
  if (st.progress === 0) {
    if (st.out >= LINE_OUTPUT || holdingOldProducts(st)) return false;
    if (missingInput(st.product, binDefs, state.bins)) return false;
    for (const metal of recipeMetals(st.product)) {
      const need = RECIPES[st.product].inputs[metal]!;
      const bin = binFor(binDefs, metal)!;
      state.bins[bin.id]!.count -= need;
      for (let i = 0; i < need; i++) events.push({ type: 'itemMoved', item: metal, from: bin.id, to: line.id });
    }
    st.progress = 1;
    return true;
  }
  st.progress++;
  if (st.progress < batchTicks(factory, st, state)) return true;
  st.progress = 0;
  st.out++;
  st.outItem = st.product;
  events.push({ type: 'processed', station: line.id, item: st.product });
  return true;
}

export function lineStatus(
  st: LineState,
  binDefs: ReadonlyMap<string, BinDef>,
  bins: Readonly<Record<string, BinState>>,
): LineStatus {
  if (!st.built) return 'unbuilt';
  if (st.progress > 0) return 'processing';
  if (st.out >= LINE_OUTPUT || holdingOldProducts(st)) return 'blocked';
  return missingInput(st.product, binDefs, bins) ? 'starved' : 'idle';
}

/**
 * Auto lines follow the trucks (once there are employees to run them): an idle Auto line whose product no
 * waiting truck still needs switches to one that a truck does need and no other line is making, preferring
 * one whose metals are in the bins. Returns true if any line changed.
 */
export function autoAssignLines(factory: FactoryDef, binDefs: ReadonlyMap<string, BinDef>, state: GameState): boolean {
  if (state.employees.length === 0) return false;
  // What waiting and arriving trucks still need, less what's already sitting on output spots.
  const need = new Map<ProductId, number>();
  for (const bay of Object.values(state.bays)) {
    if ((bay.phase === 'waiting' || bay.phase === 'arriving') && bay.item && isProduct(bay.item)) {
      need.set(bay.item, (need.get(bay.item) ?? 0) + bay.want - bay.have);
    }
  }
  for (const line of factory.lines) {
    const st = state.lines[line.id]!;
    if (st.outItem && need.has(st.outItem)) need.set(st.outItem, need.get(st.outItem)! - st.out);
  }
  let changed = false;
  for (const line of factory.lines) {
    const st = state.lines[line.id]!;
    if (!st.built || !st.auto || st.progress > 0 || (need.get(st.product) ?? 0) > 0) continue;
    const taken = new Set(factory.lines.filter((l) => l !== line && state.lines[l.id]!.built).map((l) => state.lines[l.id]!.product));
    const wanted = [...need.entries()]
      .filter(([p, n]) => n > 0 && !taken.has(p) && productUnlocked(p, state))
      .sort((a, b) => Number(!!missingInput(a[0], binDefs, state.bins)) - Number(!!missingInput(b[0], binDefs, state.bins)) || b[1] - a[1]);
    const pick = wanted[0]?.[0];
    if (pick && pick !== st.product) {
      st.product = pick;
      changed = true;
    }
  }
  return changed;
}

/**
 * Switches what a line makes, if that product is unlocked. A batch in progress is cancelled and its
 * metals go back to the bins. Returns true if the line changed.
 */
export function setLineProduct(
  factory: FactoryDef,
  lineId: string,
  product: ProductId,
  binDefs: ReadonlyMap<string, BinDef>,
  state: GameState,
): boolean {
  const st = state.lines[lineId];
  if (!st || !factory.lines.some((l) => l.id === lineId) || st.product === product || !productUnlocked(product, state)) return false;
  if (st.progress > 0) {
    for (const metal of recipeMetals(st.product)) {
      const bin = binFor(binDefs, metal);
      if (bin) state.bins[bin.id]!.count += RECIPES[st.product].inputs[metal]!;
    }
    st.progress = 0;
  }
  st.product = product;
  return true;
}
