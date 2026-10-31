import { describe, expect, it } from 'vitest';
import { BUSINESS_LEVELS, businessLevel, SHREDDER } from '../src/data/balance';
import { STATIONS, YARD } from '../src/data/layout';
import { PURCHASE, UPGRADE_EFFECTS, UPGRADES } from '../src/data/upgrades';
import { memoryStorage } from '../src/platform/memoryStorage';
import { SAVE_KEYS, SaveManager } from '../src/save/saveManager';
import { lineBatchTicks, processorOutputs } from '../src/sim/effective';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { Simulation } from '../src/sim/simulation';
import { createNewGame, isGameState, sanitizeState, secondsToTicks, type GameState } from '../src/sim/state';
import type { FactoryDef, ProcessorDef } from '../src/sim/stations';
import { newInteractionState, stepInteraction } from '../src/sim/systems/interaction';
import { stepProcessor } from '../src/sim/systems/processing';
import { fieldUnits } from '../src/sim/systems/field';

const grid = parseGrid(YARD, STATIONS);
const shredder = STATIONS.find((s): s is ProcessorDef => s.kind === 'processor')!;
const factory = STATIONS.find((s): s is FactoryDef => s.kind === 'factory')!;

function padAt(id: string) {
  return STATIONS.find((s) => s.id === id)!.rect;
}

function standOn(state: GameState, id: string, ticks: number, events: SimEvent[] = []) {
  const inter = newInteractionState();
  const r = padAt(id);
  state.player.x = r.x + 0.5;
  state.player.y = r.y + 0.5;
  for (let i = 0; i < ticks; i++) stepInteraction(state, STATIONS, inter, events);
  return events;
}

/** Runs the shredder on `inputs` scrap with an endlessly emptied tray; returns everything it made. */
function shred(state: GameState, inputs: number) {
  const machine = state.processors.shredder!;
  machine.hopper = inputs;
  const made = { iron: 0, aluminium: 0, copper: 0 };
  for (let i = 0; i < inputs * secondsToTicks(SHREDDER.cycleS) + 20; i++) {
    stepProcessor(shredder, machine, undefined, [], processorOutputs(shredder, state));
    for (const item of ['iron', 'aluminium', 'copper'] as const) {
      made[item] += machine.tray[item];
      machine.tray[item] = 0;
    }
  }
  return made;
}

describe('shredder Yield and Extraction', () => {
  it('Yield raises every output by 10% per level, exactly over time', () => {
    const state = createNewGame(grid, STATIONS);
    state.upgrades.shredderYield = 2;
    const out = SHREDDER.outputs;
    const expected = (share = 0) => Math.floor(100 * share * 1.2 + 1e-9);
    expect(shred(state, 100)).toEqual({ iron: expected(out.iron), aluminium: expected(out.aluminium), copper: expected(out.copper) });
  });

  it('Extraction adds copper, which Yield also boosts', () => {
    const state = createNewGame(grid, STATIONS);
    const base = SHREDDER.outputs.copper ?? 0;
    state.upgrades.extraction = 1;
    expect(shred(state, 100).copper).toBe(Math.floor(100 * (base + UPGRADE_EFFECTS.copperBase) + 1e-9));
    state.upgrades.extraction = 2;
    state.upgrades.shredderYield = 1;
    const perScrap = (base + UPGRADE_EFFECTS.copperBase + UPGRADE_EFFECTS.copperPerLevel) * 1.1;
    const made = shred(state, 100).copper;
    // Fractions carry between runs, so allow one either way.
    expect(Math.abs(made - 100 * perScrap)).toBeLessThanOrEqual(1);
  });
});

describe('business level', () => {
  it('follows lifetime earnings', () => {
    expect(businessLevel(0)).toBe(1);
    expect(businessLevel(BUSINESS_LEVELS[1]! - 1)).toBe(1);
    expect(businessLevel(BUSINESS_LEVELS[1]!)).toBe(2);
    expect(businessLevel(1e9)).toBe(BUSINESS_LEVELS.length);
  });

  it('gates purchases: a locked pad takes no money and says why once', () => {
    const state = createNewGame(grid, STATIONS);
    state.money = 10_000;
    const events = standOn(state, 'pad-extraction', secondsToTicks(5));
    expect(state.money).toBe(10_000);
    expect(events.filter((e) => e.type === 'locked')).toEqual([{ type: 'locked', level: UPGRADES.extraction.requiresLevel }]);

    state.earned = BUSINESS_LEVELS[UPGRADES.extraction.requiresLevel! - 1]!;
    standOn(state, 'pad-extraction', secondsToTicks(PURCHASE.delayS + PURCHASE.payS) + 5);
    expect(state.upgrades.extraction).toBeGreaterThan(0);
  });

  it('gates line upgrades behind their line', () => {
    const state = createNewGame(grid, STATIONS);
    state.money = 10_000;
    const events = standOn(state, 'pad-press-speed', secondsToTicks(5));
    expect(state.upgrades.pressSpeed).toBe(0);
    expect(events).toContainEqual({ type: 'locked', line: 'press' });
  });

  it('announces a level-up when earnings cross a threshold', () => {
    const state = createNewGame(grid, STATIONS);
    state.earned = BUSINESS_LEVELS[1]! - 1;
    state.bins['bin-iron']!.count = 10;
    state.player.x = padAt('bin-iron').x + 0.5;
    state.player.y = 7.5; // the iron bin's sell pad
    const sim = new Simulation(state, grid, STATIONS, 'dump');
    // Past the 2 s stand-still, then a few sales.
    for (let i = 0; i < 12; i++) sim.advance(250);
    const events: SimEvent[] = [];
    sim.drainEvents(events);
    expect(events).toContainEqual({ type: 'levelUp', level: 2 });
  });
});

describe('line speed', () => {
  it('shortens batches per level', () => {
    const state = createNewGame(grid, STATIONS);
    const press = factory.lines.find((l) => l.id === 'press')!;
    const base = lineBatchTicks(press, state);
    state.upgrades.pressSpeed = 3;
    expect(lineBatchTicks(press, state)).toBeLessThan(base);
  });
});

describe('save v6 → v7', () => {
  it('adds copper slots and the new upgrades', () => {
    const store = memoryStorage();
    const v6 = structuredClone(createNewGame(grid, STATIONS)) as unknown as Record<string, any>;
    for (const key of ['shredderYield', 'extraction', 'pressSpeed', 'canSpeed']) {
      delete v6.upgrades[key];
      delete v6.upgradePaid[key];
    }
    v6.upgrades.carry = 3;
    for (const p of Object.values(v6.processors) as Record<string, any>[]) {
      delete p.tray.copper;
      delete p.carry.copper;
    }
    delete v6.bins['bin-copper'];
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 6, savedAt: 0, state: v6 }));

    const loaded = new SaveManager(store, isGameState).load();
    expect(loaded).not.toBeNull();
    const state = sanitizeState(loaded!.state, grid, STATIONS);
    expect(state.upgrades.carry).toBe(3);
    expect(state.upgrades.extraction).toBe(0);
    expect(state.processors.shredder!.tray.copper).toBe(0);
    expect(state.bins['bin-copper']).toEqual({ count: 0 });
  });
});

describe('save v7 → v8', () => {
  it('scatters an old pile across the dump site and adds the Magnet upgrade', () => {
    const store = memoryStorage();
    const v7 = structuredClone(createNewGame(grid, STATIONS)) as unknown as Record<string, any>;
    delete v7.field;
    delete v7.upgrades.magnet;
    delete v7.upgradePaid.magnet;
    v7.piles = { pile: { items: 9 } };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 7, savedAt: 0, state: v7 }));

    const loaded = new SaveManager(store, isGameState).load();
    expect(loaded).not.toBeNull();
    const state = sanitizeState(loaded!.state, grid, STATIONS);
    const dump = STATIONS.find((s) => s.kind === 'dump')!;
    expect(fieldUnits(state.field)).toBeGreaterThanOrEqual(9);
    for (const p of state.field.pieces) expect(p.x >= dump.rect.x && p.x < dump.rect.x + dump.rect.w).toBe(true);
    expect(state.upgrades.magnet).toBe(0);
    expect('piles' in state).toBe(false);
    expect(isGameState(state)).toBe(true);
  });
});
