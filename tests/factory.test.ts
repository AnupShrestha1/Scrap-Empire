import { describe, expect, it } from 'vitest';
import { LINE_OUTPUT, PRICES } from '../src/data/balance';
import { PRODUCTS } from '../src/data/items';
import { STATIONS, YARD } from '../src/data/layout';
import { RECIPES } from '../src/data/recipes';
import { PURCHASE } from '../src/data/upgrades';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { Simulation } from '../src/sim/simulation';
import { createNewGame, secondsToTicks, type GameState } from '../src/sim/state';
import { inRect, type BinDef, type FactoryDef, type Rect } from '../src/sim/stations';
import { newInteractionState, stepInteraction } from '../src/sim/systems/interaction';
import { batchTicks, lineStatus, nextUnbuiltLine, setLineProduct, stepLine } from '../src/sim/systems/manufacturing';

const grid = parseGrid(YARD, STATIONS);
const factory = STATIONS.find((s): s is FactoryDef => s.kind === 'factory')!;
const line1 = factory.lines[0]!;
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

function runLine(state: GameState, ticks: number, events: SimEvent[] = []) {
  for (let i = 0; i < ticks; i++) stepLine(factory, line1, state.lines[line1.id]!, binDefs, state, events);
  return events;
}

describe('building lines', () => {
  it('starts with no lines, which do nothing', () => {
    const state = createNewGame(grid, STATIONS);
    state.bins['bin-iron']!.count = 30;
    runLine(state, 200);
    expect(state.bins['bin-iron']!.count).toBe(30);
    expect(lineStatus(state.lines[line1.id]!, binDefs, state.bins)).toBe('unbuilt');
  });

  it('builds line slots in order, each once its business level is reached and it is affordable', () => {
    const state = createNewGame(grid, STATIONS);
    const pad = factory.zones.build;
    state.money = 100_000;
    // Level 1: the first slot needs business level 3.
    const locked = standAt(state, pad.x, pad.y, 200);
    expect(state.lines['line-1']!.built).toBe(false);
    expect(locked.filter((e) => e.type === 'locked')).toEqual([{ type: 'locked', level: line1.requiresLevel }]);

    state.earned = 1e9;
    const events = standAt(state, pad.x, pad.y, 2000, [], () => !nextUnbuiltLine(factory, state));
    const total = factory.lines.reduce((sum, l) => sum + l.buildCost, 0);
    expect(state.money).toBe(100_000 - total);
    expect(events.filter((e) => e.type === 'built').map((e) => (e as { station: string }).station)).toEqual(factory.lines.map((l) => l.id));
  });
});

describe('a production line', () => {
  function withLine(): GameState {
    const state = createNewGame(grid, STATIONS);
    state.lines[line1.id]!.built = true;
    return state;
  }

  it('pulls a batch from the bins and puts the product on its output spot', () => {
    const state = withLine();
    state.bins['bin-iron']!.count = 7;
    const events = runLine(state, batchTicks(factory, state.lines[line1.id]!, state));
    expect(state.bins['bin-iron']!.count).toBe(7 - RECIPES.sheet.inputs.iron!);
    expect(state.lines[line1.id]).toMatchObject({ out: 1, outItem: 'sheet' });
    expect(events).toContainEqual({ type: 'processed', station: line1.id, item: 'sheet' });
  });

  it('mixes metals from several bins', () => {
    const state = withLine();
    state.earned = 1e9;
    state.upgrades.extraction = 1;
    expect(setLineProduct(factory, line1.id, 'motor', binDefs, state)).toBe(true);
    state.bins['bin-iron']!.count = 5;
    state.bins['bin-copper']!.count = 5;
    runLine(state, batchTicks(factory, state.lines[line1.id]!, state));
    expect(state.bins['bin-iron']!.count).toBe(3);
    expect(state.bins['bin-copper']!.count).toBe(4);
    expect(state.lines[line1.id]!.outItem).toBe('motor');
  });

  it('only switches to products whose metals are unlocked, and refunds a cancelled batch', () => {
    const state = withLine();
    expect(setLineProduct(factory, line1.id, 'jetEngine', binDefs, state)).toBe(false);
    state.earned = 1e9; // business level 8: aluminium unlocked
    state.bins['bin-iron']!.count = 3;
    runLine(state, 3);
    expect(state.bins['bin-iron']!.count).toBe(0);
    expect(setLineProduct(factory, line1.id, 'can', binDefs, state)).toBe(true);
    expect(state.bins['bin-iron']!.count).toBe(3);
    expect(state.lines[line1.id]!.progress).toBe(0);
  });

  it('holds when products from an earlier recipe are still waiting', () => {
    const state = withLine();
    state.earned = 1e9;
    Object.assign(state.lines[line1.id]!, { out: 2, outItem: 'sheet' });
    setLineProduct(factory, line1.id, 'can', binDefs, state);
    state.bins['bin-aluminium']!.count = 10;
    runLine(state, 200);
    expect(state.bins['bin-aluminium']!.count).toBe(10);
    expect(lineStatus(state.lines[line1.id]!, binDefs, state.bins)).toBe('blocked');
  });

  it('pauses when its output spot is full, without taking more iron', () => {
    const state = withLine();
    state.bins['bin-iron']!.count = 1000;
    runLine(state, (LINE_OUTPUT + 3) * (batchTicks(factory, state.lines[line1.id]!, state) + 1));
    expect(state.lines[line1.id]!.out).toBe(LINE_OUTPUT);
    expect(state.bins['bin-iron']!.count).toBe(1000 - LINE_OUTPUT * RECIPES.sheet.inputs.iron!);
  });

  it('hands products to the player at its output spot', () => {
    const state = withLine();
    Object.assign(state.lines[line1.id]!, { out: 3, outItem: 'sheet' });
    standAt(state, line1.output.x, line1.output.y, 40);
    expect(state.player.stack).toEqual(['sheet', 'sheet', 'sheet']);
    expect(state.lines[line1.id]).toMatchObject({ out: 0, outItem: null });
  });

  it('waits when a bin is short', () => {
    const state = withLine();
    state.bins['bin-iron']!.count = RECIPES.sheet.inputs.iron! - 1;
    runLine(state, 200);
    expect(state.lines[line1.id]!.out).toBe(0);
    expect(lineStatus(state.lines[line1.id]!, binDefs, state.bins)).toBe('starved');
  });

  it('makes every product worth more than selling its metals raw', () => {
    for (const product of PRODUCTS) {
      let raw = 0;
      for (const [metal, n] of Object.entries(RECIPES[product].inputs)) raw += PRICES[metal as keyof typeof PRICES] * n!;
      expect(PRICES[product], product).toBeGreaterThan(raw);
    }
  });
});

describe('the recipe pad', () => {
  it('opens the recipe card after the stand-still, once per visit', () => {
    const state = createNewGame(grid, STATIONS);
    const pad = factory.zones.recipes;
    const events = standAt(state, pad.x, pad.y, secondsToTicks(PURCHASE.delayS) + 20);
    expect(events.filter((e) => e.type === 'recipesOpen')).toHaveLength(1);
  });

  it('lets the view change what a line makes through the simulation', () => {
    const state = createNewGame(grid, STATIONS);
    state.lines[line1.id]!.built = true;
    state.earned = 1e9;
    const sim = new Simulation(state, grid, STATIONS, 'dump');
    expect(sim.setLineProduct(line1.id, 'toolbox')).toBe(true);
    expect(state.lines[line1.id]!.product).toBe('toolbox');
  });
});

describe('pad placement', () => {
  it('keeps pads that sell or spend off the walking routes between stations', () => {
    // Straight-line routes the player walks: from the dump field's edge to the shredder input, input to
    // output, output to each bin's drop-off, each bin to the factory's build pad, and each line output to
    // each truck.
    const dump = STATIONS.find((s) => s.id === 'dump')!;
    const shredder = STATIONS.find((s) => s.id === 'shredder')!;
    const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const field = dump.rect;
    const fieldEdge = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ x: field.x + field.w, y: field.y + field.h * t }));
    const input = centre((shredder.zones as { input: Rect }).input);
    const output = centre((shredder.zones as { output: Rect }).output);
    const build = centre(factory.zones.build);
    const bays = STATIONS.filter((s) => s.kind === 'bay').map((b) => centre((b.zones as { load: Rect }).load));
    const outputs = factory.lines.map((l) => centre(l.output));
    const routes = [
      ...fieldEdge.map((p) => [p, input]),
      ...outputs.flatMap((o) => bays.map((b) => [o, b])),
      [input, output],
      ...bins.map((b) => [output, centre(b.zones.deposit)]),
      ...bins.map((b) => [centre(b.zones.deposit), build]),
    ] as const;
    const pads = STATIONS.flatMap((s) => {
      if (s.kind === 'cashPad' || s.kind === 'outlet') return [{ id: s.id, r: s.rect }];
      if (s.kind === 'dealer') return [{ id: s.id, r: s.zones.sell }, { id: `${s.id} stock`, r: s.zones.stock }];
      if (s.kind === 'factory') return [{ id: 'recipes', r: s.zones.recipes }];
      return [];
    });
    for (const [i, [a, b]] of routes.entries()) {
      for (let t = 0; t <= 1; t += 0.01) {
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        for (const pad of pads) expect(inRect(pad.r, x, y), `${pad.id} on route ${i}`).toBe(false);
      }
    }
  });
});
