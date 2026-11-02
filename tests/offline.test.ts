import { describe, expect, it } from 'vitest';
import { BUSINESS_LEVELS, OFFLINE } from '../src/data/balance';
import { STATIONS, YARD } from '../src/data/layout';
import { memoryStorage } from '../src/platform/memoryStorage';
import { SAVE_KEYS, SaveManager } from '../src/save/saveManager';
import { parseGrid } from '../src/sim/grid';
import { offlineEarnings } from '../src/sim/offline';
import { Simulation } from '../src/sim/simulation';
import { createNewGame, isGameState, sanitizeState } from '../src/sim/state';

const grid = parseGrid(YARD, STATIONS);
const HOUR = 60 * 60 * 1000;

function withStaff(rate: number) {
  const state = createNewGame(grid, STATIONS);
  state.employees.push({ id: 0, x: 10.5, y: 12.5, facing: 'down', stack: [] });
  state.autoRate = rate;
  return state;
}

describe('offline earnings', () => {
  it('pay nothing without employees, or for a short absence', () => {
    const state = createNewGame(grid, STATIONS);
    state.autoRate = 10;
    expect(offlineEarnings(state, HOUR)).toBeNull();
    expect(offlineEarnings(withStaff(10), (OFFLINE.minAwayS - 1) * 1000)).toBeNull();
  });

  it('pay the employees’ measured rate at a discount, capped at two hours', () => {
    const state = withStaff(10);
    expect(offlineEarnings(state, HOUR)).toEqual({ seconds: 3600, awaySeconds: 3600, amount: Math.floor(10 * 3600 * OFFLINE.efficiency) });
    const long = offlineEarnings(state, 10 * HOUR)!;
    expect(long.seconds).toBe(OFFLINE.capS);
    expect(long.awaySeconds).toBe(36_000);
  });

  it('count towards business levels, with their chests', () => {
    const state = withStaff(10);
    state.earned = BUSINESS_LEVELS[1]! - 1;
    const sim = new Simulation(state, grid, STATIONS, 'dump');
    const result = sim.applyOffline(HOUR)!;
    expect(state.earned).toBe(BUSINESS_LEVELS[1]! - 1 + result.amount);
    const events = sim.drainEvents([]);
    expect(events.some((e) => e.type === 'levelUp')).toBe(true);
  });

  it('are measured from what the employees actually do during play', () => {
    const state = createNewGame(grid, STATIONS);
    state.player.x = grid.playerStart.x;
    state.player.y = grid.playerStart.y;
    for (let i = 0; i < 3; i++) state.employees.push({ id: i, x: 10.5 + i, y: 12.5, facing: 'down', stack: [] });
    state.upgrades.staffCarry = 3;
    state.upgrades.staffSpeed = 3;
    state.bins['bin-iron']!.count = 30; // full, so the employees sell the overflow
    const sim = new Simulation(state, grid, STATIONS, 'dump');
    for (let i = 0; i < 4 * 180; i++) sim.advance(250);
    expect(state.staffShare).toBeGreaterThan(0.5);
    expect(state.autoRate).toBeGreaterThan(0);
  });
});

describe('save v13 → v14', () => {
  it('starts the offline estimates from nothing', () => {
    const store = memoryStorage();
    const v13 = structuredClone(createNewGame(grid, STATIONS)) as unknown as Record<string, any>;
    delete v13.autoRate;
    delete v13.staffShare;
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 13, savedAt: 0, state: v13 }));
    const loaded = new SaveManager(store, isGameState).load();
    expect(loaded).not.toBeNull();
    const state = sanitizeState(loaded!.state, grid, STATIONS);
    expect(state.autoRate).toBe(0);
    expect(state.staffShare).toBe(0);
  });
});
