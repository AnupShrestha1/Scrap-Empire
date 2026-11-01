import { describe, expect, it } from 'vitest';
import { BUSINESS_LEVELS, businessLevel, METAL_FINDS, PRICES, SHREDDER } from '../src/data/balance';
import { METALS } from '../src/data/items';
import { STATIONS, YARD } from '../src/data/layout';
import { PURCHASE, requiredLevel } from '../src/data/upgrades';
import { levelChest } from '../src/data/unlocks';
import { memoryStorage } from '../src/platform/memoryStorage';
import { SAVE_KEYS, SaveManager } from '../src/save/saveManager';
import { lineBatchTicks, processorCycleTicks, shredderFinds, unlockedMetals } from '../src/sim/effective';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { Simulation } from '../src/sim/simulation';
import { createNewGame, isGameState, sanitizeState, secondsToTicks, type GameState } from '../src/sim/state';
import type { DealerDef, FactoryDef, ProcessorDef } from '../src/sim/stations';
import { newInteractionState, stepInteraction } from '../src/sim/systems/interaction';
import { fieldUnits } from '../src/sim/systems/field';

const grid = parseGrid(YARD, STATIONS);
const shredder = STATIONS.find((s): s is ProcessorDef => s.kind === 'processor')!;
const factory = STATIONS.find((s): s is FactoryDef => s.kind === 'factory')!;

function padAt(id: string) {
  return STATIONS.find((s) => s.id === id)!.rect;
}

function standOn(state: GameState, id: string, ticks: number, events: SimEvent[] = [], until = () => false) {
  const inter = newInteractionState();
  const r = padAt(id);
  state.player.x = r.x + 0.5;
  state.player.y = r.y + 0.5;
  for (let i = 0; i < ticks && !until(); i++) stepInteraction(state, STATIONS, inter, events);
  return events;
}

describe('metals', () => {
  it('starts with iron only; aluminium comes with business level 2', () => {
    const state = createNewGame(grid, STATIONS);
    expect(unlockedMetals(state)).toEqual(['iron']);
    expect(shredderFinds(state)).toEqual({ iron: 1, chances: {} });
    state.earned = BUSINESS_LEVELS[1]!;
    expect(unlockedMetals(state)).toEqual(['iron', 'aluminium']);
    expect(shredderFinds(state).chances.aluminium).toBeCloseTo(METAL_FINDS.aluminium.chance);
  });

  it('unlocks copper, titanium, gold and platinum at Extraction 1, 3, 5 and 7', () => {
    const state = createNewGame(grid, STATIONS);
    state.earned = 1e9;
    const at = (level: number) => {
      state.upgrades.extraction = level;
      return unlockedMetals(state);
    };
    expect(at(0)).toEqual(['iron', 'aluminium']);
    expect(at(1)).toEqual(['iron', 'aluminium', 'copper']);
    expect(at(3)).toContain('titanium');
    expect(at(4)).not.toContain('gold');
    expect(at(5)).toContain('gold');
    expect(at(7)).toEqual([...METALS]);
  });

  it('makes rarer metals rarer and worth more', () => {
    for (let i = 2; i < METALS.length; i++) {
      expect(METAL_FINDS[METALS[i]!].chance).toBeLessThan(METAL_FINDS[METALS[i - 1]!].chance);
      expect(PRICES[METALS[i]!]).toBeGreaterThan(PRICES[METALS[i - 1]!]);
    }
  });

  it('raises the chances with each Extraction level, and Yield raises everything', () => {
    const state = createNewGame(grid, STATIONS);
    state.earned = 1e9;
    state.upgrades.extraction = 1;
    const before = shredderFinds(state).chances.copper!;
    state.upgrades.extraction = 2;
    expect(shredderFinds(state).chances.copper!).toBeCloseTo(before + METAL_FINDS.copper.perLevel);
    state.upgrades.shredderYield = 2;
    const finds = shredderFinds(state);
    expect(finds.iron).toBeCloseTo(1.2);
    expect(finds.chances.copper!).toBeCloseTo((before + METAL_FINDS.copper.perLevel) * 1.2);
  });

  it('starts the shredder warm, then settles to its normal pace', () => {
    const state = createNewGame(grid, STATIONS);
    const machine = state.processors.shredder!;
    const warm = processorCycleTicks(shredder, state, machine);
    machine.shredded = SHREDDER.warmCount;
    expect(processorCycleTicks(shredder, state, machine)).toBeGreaterThan(warm);
  });
});

describe('business level', () => {
  it('follows lifetime earnings, up to level 8', () => {
    expect(businessLevel(0)).toBe(1);
    expect(businessLevel(BUSINESS_LEVELS[1]! - 1)).toBe(1);
    expect(businessLevel(BUSINESS_LEVELS[1]!)).toBe(2);
    expect(businessLevel(1e9)).toBe(8);
  });

  it('gates each Extraction level: a locked pad takes no money and says why once', () => {
    const state = createNewGame(grid, STATIONS);
    state.money = 100_000;
    const gate = requiredLevel('extraction', 0);
    const events = standOn(state, 'pad-extraction', secondsToTicks(5));
    expect(state.money).toBe(100_000);
    expect(events.filter((e) => e.type === 'locked')).toEqual([{ type: 'locked', level: gate }]);

    state.earned = BUSINESS_LEVELS[gate - 1]!;
    standOn(state, 'pad-extraction', secondsToTicks(PURCHASE.delayS + PURCHASE.payS) + 5, [], () => state.upgrades.extraction === 1);
    expect(state.upgrades.extraction).toBe(1);
    // The next level needs a higher business level.
    const next = standOn(state, 'pad-extraction', secondsToTicks(5));
    expect(state.upgrades.extraction).toBe(1);
    expect(next).toContainEqual({ type: 'locked', level: requiredLevel('extraction', 1) });
  });

  it('gates line speed behind the first line', () => {
    const state = createNewGame(grid, STATIONS);
    state.money = 10_000;
    const events = standOn(state, 'pad-line-speed', secondsToTicks(5));
    expect(state.upgrades.lineSpeed).toBe(0);
    expect(events).toContainEqual({ type: 'locked', line: 'line-1' });
  });

  it('announces a level-up when earnings cross a threshold', () => {
    const state = createNewGame(grid, STATIONS);
    state.earned = BUSINESS_LEVELS[1]! - 1;
    state.player.stack = ['iron', 'iron'];
    const dealer = STATIONS.find((d): d is DealerDef => d.kind === 'dealer')!;
    state.player.x = dealer.zones.sell.x + 0.5;
    state.player.y = dealer.zones.sell.y + 0.5;
    const sim = new Simulation(state, grid, STATIONS, 'dump');
    // Past the 2 s stand-still, then a sale.
    for (let i = 0; i < 12; i++) sim.advance(250);
    const events: SimEvent[] = [];
    sim.drainEvents(events);
    expect(events).toContainEqual({ type: 'levelUp', level: 2, chest: levelChest(2) });
  });

  it('pays a chest per level reached, without counting it as earnings', () => {
    const state = createNewGame(grid, STATIONS);
    state.earned = BUSINESS_LEVELS[3]! - 1;
    state.player.stack = ['iron'];
    const dealer = STATIONS.find((d): d is DealerDef => d.kind === 'dealer')!;
    state.player.x = dealer.zones.sell.x + 0.5;
    state.player.y = dealer.zones.sell.y + 0.5;
    const sim = new Simulation(state, grid, STATIONS, 'dump');
    for (let i = 0; i < 12; i++) sim.advance(250);
    expect(state.money).toBe(PRICES.iron + levelChest(4));
    expect(state.earned).toBe(BUSINESS_LEVELS[3]! - 1 + PRICES.iron);
  });
});

describe('line speed', () => {
  it('shortens batches per level', () => {
    const state = createNewGame(grid, STATIONS);
    const base = lineBatchTicks(factory, 'sheet', state);
    state.upgrades.lineSpeed = 3;
    expect(lineBatchTicks(factory, 'sheet', state)).toBeLessThan(base);
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

describe('save v10 → v11', () => {
  it('turns the press and can line into lines 1 and 2, merges their speed upgrades and adds the new metals', () => {
    const store = memoryStorage();
    const v10 = structuredClone(createNewGame(grid, STATIONS)) as unknown as Record<string, any>;
    v10.lines = { press: { built: true, progress: 2, out: 3 }, 'can-line': { built: true, progress: 0, out: 0 } };
    for (const key of ['upgrades', 'upgradePaid']) {
      delete v10[key].lineSpeed;
      Object.assign(v10[key], { pressSpeed: key === 'upgrades' ? 2 : 0, canSpeed: key === 'upgrades' ? 4 : 0 });
    }
    for (const p of Object.values(v10.processors) as Record<string, any>[]) {
      p.tray = { scrap: 0, iron: 2, aluminium: 1, copper: 0, sheet: 0, can: 0 };
      p.carry = { scrap: 0, iron: 0.5, aluminium: 0, copper: 0, sheet: 0, can: 0 };
      delete p.shredded;
    }
    delete v10.firstOrder;
    v10.objectives = { index: 13, progress: 0 };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 10, savedAt: 0, state: v10 }));

    const loaded = new SaveManager(store, isGameState).load();
    expect(loaded).not.toBeNull();
    const state = sanitizeState(loaded!.state, grid, STATIONS);
    expect(state.lines['line-1']).toEqual({ built: true, product: 'sheet', auto: true, progress: 0, out: 3, outItem: 'sheet' });
    expect(state.lines['line-2']).toMatchObject({ built: true, product: 'can' });
    expect(state.upgrades.lineSpeed).toBe(4);
    expect(state.processors.shredder!.tray).toMatchObject({ iron: 2, aluminium: 1, gold: 0, motor: 0 });
    expect(state.firstOrder).toBe(true);
    expect(state.objectives.index).toBe(10);
    expect(state.bins['bin-platinum']).toEqual({ count: 0 });
  });
});
