import { LINE_OUTPUT } from '../../data/balance';
import { ITEM_IDS, type ItemId } from '../../data/items';
import type { SimEvent } from '../events';
import { lineBatchTicks } from '../effective';
import type { BinState, GameState, LineState } from '../state';
import type { BinDef, FactoryDef, LineDef } from '../stations';

export type LineStatus = 'unbuilt' | 'idle' | 'starved' | 'processing' | 'blocked';

/** Batch time after the line's speed upgrade. */
export function batchTicks(line: LineDef, state: GameState): number {
  return lineBatchTicks(line, state);
}

/** The feed bin for an input item. */
export function feedBinFor(line: LineDef, bins: ReadonlyMap<string, BinDef>, item: ItemId): BinDef | undefined {
  for (const id of line.feeds) {
    const bin = bins.get(id);
    if (bin?.item === item) return bin;
  }
  return undefined;
}

/** The first input the feed bins can't cover for a batch, if any. */
export function missingInput(
  line: LineDef,
  binDefs: ReadonlyMap<string, BinDef>,
  bins: Readonly<Record<string, BinState>>,
): ItemId | undefined {
  for (const item of ITEM_IDS) {
    const need = line.recipe.inputs[item];
    if (!need) continue;
    const bin = feedBinFor(line, binDefs, item);
    if (!bin || bins[bin.id]!.count < need) return item;
  }
  return undefined;
}

/** The next line the factory's build pad sells, in layout order. */
export function nextUnbuiltLine(factory: FactoryDef, state: GameState): LineDef | undefined {
  return factory.lines.find((line) => !state.lines[line.id]?.built);
}

/**
 * One tick of a production line: when idle with room on its output spot, pull a batch of inputs straight
 * from its feed bins; when the batch time is up, the product lands on the output spot to be collected.
 * Returns true if anything changed.
 */
export function stepLine(
  line: LineDef,
  st: LineState,
  binDefs: ReadonlyMap<string, BinDef>,
  state: GameState,
  events: SimEvent[],
): boolean {
  if (!st.built) return false;
  if (st.progress === 0) {
    if (st.out >= LINE_OUTPUT) return false;
    if (missingInput(line, binDefs, state.bins)) return false;
    for (const item of ITEM_IDS) {
      const need = line.recipe.inputs[item];
      if (!need) continue;
      const bin = feedBinFor(line, binDefs, item)!;
      state.bins[bin.id]!.count -= need;
      for (let i = 0; i < need; i++) events.push({ type: 'itemMoved', item, from: bin.id, to: line.id });
    }
    st.progress = 1;
    return true;
  }
  st.progress++;
  if (st.progress < batchTicks(line, state)) return true;
  st.progress = 0;
  st.out++;
  events.push({ type: 'processed', station: line.id, item: line.recipe.output });
  return true;
}

export function lineStatus(
  line: LineDef,
  st: LineState,
  binDefs: ReadonlyMap<string, BinDef>,
  bins: Readonly<Record<string, BinState>>,
): LineStatus {
  if (!st.built) return 'unbuilt';
  if (st.progress > 0) return 'processing';
  if (st.out >= LINE_OUTPUT) return 'blocked';
  return missingInput(line, binDefs, bins) ? 'starved' : 'idle';
}
