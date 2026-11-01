import { describe, expect, it } from 'vitest';
import { BUSINESS_LEVELS, ORDERS, PRICES } from '../src/data/balance';
import { STATIONS, YARD } from '../src/data/layout';
import { PURCHASE } from '../src/data/upgrades';
import { memoryStorage } from '../src/platform/memoryStorage';
import { SAVE_KEYS, SaveManager } from '../src/save/saveManager';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { createNewGame, isGameState, sanitizeState, secondsToTicks, type GameState } from '../src/sim/state';
import type { BayDef, FactoryDef, OutletDef } from '../src/sim/stations';
import { stepBay } from '../src/sim/systems/bays';
import { newInteractionState, stepInteraction } from '../src/sim/systems/interaction';

const grid = parseGrid(YARD, STATIONS);
const factory = STATIONS.find((s): s is FactoryDef => s.kind === 'factory')!;
const bayA = STATIONS.find((s): s is BayDef => s.id === 'bay-a')!;
const outlet = STATIONS.find((s): s is OutletDef => s.kind === 'outlet')!;

function runBay(state: GameState, ticks: number, events: SimEvent[] = []) {
  for (let i = 0; i < ticks; i++) stepBay(bayA, state.bays[bayA.id]!, state, [factory], events);
  return events;
}

function standAt(state: GameState, x: number, y: number, ticks: number, events: SimEvent[] = []) {
  const inter = newInteractionState();
  state.player.x = x + 0.5;
  state.player.y = y + 0.5;
  for (let i = 0; i < ticks; i++) stepInteraction(state, STATIONS, inter, events);
  return events;
}

/** A game past its first order, with line 1 making sheets and a truck waiting in bay A. */
function waitingTruck(): GameState {
  const state = createNewGame(grid, STATIONS);
  state.earned = BUSINESS_LEVELS[2]!;
  state.lines['line-1']!.built = true;
  state.firstOrder = true;
  runBay(state, secondsToTicks(ORDERS.driveInS + 2));
  // Orders are random; pin this one to sheets so the tests below can fill it.
  state.bays[bayA.id]!.item = 'sheet';
  return state;
}

describe('the loading bay', () => {
  it('stays empty until a production line exists', () => {
    const state = createNewGame(grid, STATIONS);
    runBay(state, secondsToTicks(60));
    expect(state.bays[bayA.id]!.phase).toBe('empty');
  });

  it('sends the first truck the moment the first product is made, wanting just a few', () => {
    const state = createNewGame(grid, STATIONS);
    state.earned = BUSINESS_LEVELS[2]!;
    const line = state.lines['line-1']!;
    line.built = true;
    line.product = 'toolbox';
    runBay(state, 2);
    expect(state.bays[bayA.id]!.phase).toBe('empty');
    Object.assign(line, { out: 1, outItem: 'toolbox' });
    runBay(state, 1);
    expect(state.bays[bayA.id]).toMatchObject({ phase: 'arriving', item: 'toolbox', want: ORDERS.firstAmount });
    expect(state.firstOrder).toBe(true);
  });

  it('gets trucks ordering a mix of unlocked products, not just what the lines make', () => {
    const state = createNewGame(grid, STATIONS);
    state.earned = BUSINESS_LEVELS[2]!; // level 3: iron and aluminium products
    state.lines['line-1']!.built = true;
    state.firstOrder = true;
    const seen = new Set<string>();
    for (let n = 0; n < 40; n++) {
      Object.assign(state.bays[bayA.id]!, { phase: 'empty', timer: 1, item: null });
      runBay(state, 2);
      const bay = state.bays[bayA.id]!;
      expect(bay.phase).toBe('arriving');
      expect(bay.want).toBeGreaterThanOrEqual(ORDERS.minAmount);
      expect(bay.want).toBeLessThanOrEqual(ORDERS.maxAmount);
      seen.add(bay.item!);
    }
    expect([...seen].sort()).toEqual(['can', 'sheet', 'toolbox']);
  });

  it('pays the order bonus when the truck is filled, then sends it off', () => {
    const state = waitingTruck();
    const bay = state.bays[bayA.id]!;
    state.player.stack = Array(bay.want).fill('sheet');
    const z = bayA.zones.load;
    const events = standAt(state, z.x, z.y, 60);
    expect(state.player.stack).toEqual([]);
    expect(state.money).toBe(Math.round(PRICES.sheet * bay.want * ORDERS.bonus));
    expect(bay.phase).toBe('leaving');
    expect(events.some((e) => e.type === 'orderFilled')).toBe(true);
  });

  it('only takes what the truck asked for', () => {
    const state = waitingTruck();
    state.player.stack = ['can', 'iron', 'sheet'];
    const z = bayA.zones.load;
    standAt(state, z.x, z.y, 40);
    expect(state.player.stack).toEqual(['can', 'iron']);
    expect(state.bays[bayA.id]!.have).toBe(1);
  });

  it('lets an unfilled truck leave unpaid when its patience runs out', () => {
    const state = waitingTruck();
    const events = runBay(state, secondsToTicks(ORDERS.patienceS) + 1);
    expect(state.bays[bayA.id]!.phase).toBe('leaving');
    expect(state.money).toBe(0);
    expect(events.some((e) => e.type === 'orderExpired')).toBe(true);
  });
});

describe('truck lanes', () => {
  it('open one per business level, from 3 to 8', () => {
    const bays = STATIONS.filter((s): s is BayDef => s.kind === 'bay');
    expect(bays).toHaveLength(6);
    expect(bays.map((b) => b.requiresLevel).sort()).toEqual([3, 4, 5, 6, 7, 8]);
    const state = createNewGame(grid, STATIONS);
    state.lines['line-1']!.built = true;
    state.firstOrder = true;
    state.earned = BUSINESS_LEVELS[3]!; // level 4: bays A and B
    for (let i = 0; i < 5; i++) for (const b of bays) stepBay(b, state.bays[b.id]!, state, [factory], []);
    expect(bays.filter((b) => state.bays[b.id]!.phase !== 'empty').map((b) => b.id)).toEqual(['bay-a', 'bay-b']);
  });
});

describe('the stall', () => {
  it('sells carried products at their price after the stand-still, and no metal', () => {
    const state = createNewGame(grid, STATIONS);
    state.player.stack = ['sheet', 'iron', 'motor'];
    standAt(state, outlet.rect.x, outlet.rect.y, secondsToTicks(PURCHASE.delayS) - 1);
    expect(state.player.stack).toHaveLength(3);
    standAt(state, outlet.rect.x, outlet.rect.y, secondsToTicks(PURCHASE.delayS) + 20);
    expect(state.player.stack).toEqual(['iron']);
    expect(state.money).toBe(PRICES.sheet + PRICES.motor);
  });

  it('pays less than a truck for the same products', () => {
    expect(PRICES.sheet * ORDERS.bonus).toBeGreaterThan(PRICES.sheet);
  });
});

describe('save v8 → v11', () => {
  it('adds output spots and empty bays, and the press becomes line 1', () => {
    const store = memoryStorage();
    const v8 = structuredClone(createNewGame(grid, STATIONS)) as unknown as Record<string, any>;
    delete v8.bays;
    v8.lines = { press: { built: true, progress: 3 }, 'can-line': { built: false, progress: 0 } };
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 8, savedAt: 0, state: v8 }));
    const loaded = new SaveManager(store, isGameState).load();
    expect(loaded).not.toBeNull();
    const state = sanitizeState(loaded!.state, grid, STATIONS);
    expect(state.lines['line-1']).toEqual({ built: true, product: 'sheet', auto: true, progress: 0, out: 0, outItem: null });
    expect(state.lines['line-2']).toMatchObject({ built: false, product: 'can' });
    expect(state.bays['bay-a']!.phase).toBe('empty');
  });
});
