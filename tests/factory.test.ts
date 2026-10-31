import { describe, expect, it } from 'vitest';
import { BUILD_COSTS, PRESS, PRICES } from '../src/data/balance';
import { STATIONS, YARD } from '../src/data/layout';
import { PURCHASE } from '../src/data/upgrades';
import { memoryStorage } from '../src/platform/memoryStorage';
import { SAVE_KEYS, SaveManager } from '../src/save/saveManager';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { createNewGame, isGameState, sanitizeState, secondsToTicks, type GameState } from '../src/sim/state';
import { inRect, type BinDef, type FactoryDef, type Rect } from '../src/sim/stations';
import { newInteractionState, stepInteraction } from '../src/sim/systems/interaction';
import { batchTicks, lineStatus, nextUnbuiltLine, stepLine } from '../src/sim/systems/manufacturing';

const grid = parseGrid(YARD, STATIONS);
const factory = STATIONS.find((s): s is FactoryDef => s.kind === 'factory')!;
const press = factory.lines.find((l) => l.id === 'press')!;
const bins = STATIONS.filter((s): s is BinDef => s.kind === 'bin');
const binDefs = new Map(bins.map((b) => [b.id, b]));

/** Stands at the centre of tile (x, y) for up to `ticks`, stopping early once `until` holds. */
function standAt(state: GameState, x: number, y: number, ticks: number, events: SimEvent[] = [], until = () => false) {
  const inter = newInteractionState();
  state.player.x = x + 0.5;
  state.player.y = y + 0.5;
  for (let i = 0; i < ticks && !until(); i++) stepInteraction(state, STATIONS, inter, events);
  return events;
}

function runPress(state: GameState, ticks: number, events: SimEvent[] = []) {
  for (let i = 0; i < ticks; i++) stepLine(factory, press, state.lines.press!, binDefs, state, events);
  return events;
}

describe('building lines', () => {
  it('starts with no lines, which do nothing', () => {
    const state = createNewGame(grid, STATIONS);
    state.bins['bin-iron']!.count = 30;
    runPress(state, 200);
    expect(state.bins['bin-iron']!.count).toBe(30);
    expect(lineStatus(press, state.lines.press!, binDefs, state.bins)).toBe('unbuilt');
  });

  it('builds lines in order on the one build pad, keeping partial payments', () => {
    const state = createNewGame(grid, STATIONS);
    const pad = factory.zones.build;
    state.money = 50;
    standAt(state, pad.x, pad.y, 200);
    expect(state.buildPaid.press).toBe(50);
    expect(state.lines.press!.built).toBe(false);

    // The Can line needs business level 2.
    state.earned = 150;
    state.money = 1000;
    const events = standAt(state, pad.x, pad.y, 400, [], () => state.lines['can-line']!.built);
    expect(state.lines.press!.built).toBe(true);
    expect(state.lines['can-line']!.built).toBe(true);
    expect(state.money).toBe(1000 - (BUILD_COSTS.press - 50) - BUILD_COSTS.canLine);
    expect(events.filter((e) => e.type === 'built').map((e) => (e as { station: string }).station)).toEqual(['press', 'can-line']);
    expect(nextUnbuiltLine(factory, state)).toBeUndefined();
  });
});

describe('a production line', () => {
  function withPress(): GameState {
    const state = createNewGame(grid, STATIONS);
    state.lines.press!.built = true;
    return state;
  }

  it('pulls a batch from its bin and sells the product the moment it is made', () => {
    const state = withPress();
    state.bins['bin-iron']!.count = 7;
    const events = runPress(state, batchTicks(press, state));
    expect(state.bins['bin-iron']!.count).toBe(7 - PRESS.inputs.iron!);
    expect(state.money).toBe(PRICES.sheet);
    expect(state.earned).toBe(PRICES.sheet);
    expect(events).toContainEqual({ type: 'sold', station: 'factory', item: 'sheet', value: PRICES.sheet });
  });

  it('waits when its bin is short', () => {
    const state = withPress();
    state.bins['bin-iron']!.count = PRESS.inputs.iron! - 1;
    runPress(state, 200);
    expect(state.money).toBe(0);
    expect(lineStatus(press, state.lines.press!, binDefs, state.bins)).toBe('starved');
  });

  it('is worth more than selling its inputs raw', () => {
    for (const line of factory.lines) {
      let raw = 0;
      for (const [item, n] of Object.entries(line.recipe.inputs)) raw += PRICES[item as keyof typeof PRICES] * n!;
      expect(PRICES[line.recipe.output]).toBeGreaterThan(raw);
    }
  });
});

describe('selling from bins', () => {
  it('sells nothing while just walking across the pad', () => {
    const state = createNewGame(grid, STATIONS);
    const iron = binDefs.get('bin-iron')!;
    state.bins[iron.id]!.count = 10;
    standAt(state, iron.zones.sell.x, iron.zones.sell.y, secondsToTicks(PURCHASE.delayS) - 1);
    expect(state.bins[iron.id]!.count).toBe(10);
    standAt(state, iron.zones.sell.x, iron.zones.sell.y, secondsToTicks(3));
    expect(state.bins[iron.id]!.count).toBe(0);
  });

  it('keeps sell pads off the walking routes between stations', () => {
    // Straight-line routes the player walks: from anywhere on the dump field's edge facing the shredder
    // → shredder input → shredder output, then from the output to each bin's drop-off, and from each bin
    // to the factory's build pad.
    const dump = STATIONS.find((s) => s.id === 'dump')!;
    const shredder = STATIONS.find((s) => s.id === 'shredder')!;
    const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const field = dump.rect;
    const fieldEdge = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ x: field.x + field.w, y: field.y + field.h * t }));
    const input = centre((shredder.zones as { input: Rect }).input);
    const output = centre((shredder.zones as { output: Rect }).output);
    const build = centre(factory.zones.build);
    const routes = [
      ...fieldEdge.map((p) => [p, input]),
      [input, output],
      ...bins.map((b) => [output, centre(b.zones.deposit)]),
      ...bins.map((b) => [centre(b.zones.deposit), build]),
    ] as const;
    for (const [i, [a, b]] of routes.entries()) {
      for (let t = 0; t <= 1; t += 0.01) {
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        for (const bin of bins) expect(inRect(bin.zones.sell, x, y), `${bin.id} sell pad on route ${i}`).toBe(false);
      }
    }
  });
});

describe('save v5 → v6', () => {
  it('turns built machines into built factory lines', () => {
    const store = memoryStorage();
    const v5 = structuredClone(createNewGame(grid, STATIONS)) as unknown as Record<string, any>;
    delete v5.lines;
    v5.manufacturers = { press: { built: true, progress: 2, tray: 3 }, 'can-line': { built: false, progress: 0, tray: 0 } };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 5, savedAt: 0, state: v5 }));

    const loaded = new SaveManager(store, isGameState).load();
    expect(loaded).not.toBeNull();
    const state = sanitizeState(loaded!.state, grid, STATIONS);
    expect(state.lines.press).toEqual({ built: true, progress: 0 });
    expect(state.lines['can-line']).toEqual({ built: false, progress: 0 });
    expect('manufacturers' in state).toBe(false);
  });
});
