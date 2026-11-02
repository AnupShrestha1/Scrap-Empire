import { describe, expect, it } from 'vitest';
import { BUSINESS_LEVELS, STAFF } from '../src/data/balance';
import { STATIONS, YARD } from '../src/data/layout';
import { PURCHASE, UPGRADE_EFFECTS, UPGRADES } from '../src/data/upgrades';
import { PLAYER } from '../src/data/player';
import { staffCapacity, staffSpeed } from '../src/sim/effective';
import { memoryStorage } from '../src/platform/memoryStorage';
import { SAVE_KEYS, SaveManager } from '../src/save/saveManager';
import { parseGrid } from '../src/sim/grid';
import { findPath, walkable } from '../src/sim/path';
import { Simulation } from '../src/sim/simulation';
import { createNewGame, isGameState, sanitizeState, secondsToTicks, type GameState } from '../src/sim/state';
import type { SimEvent } from '../src/sim/events';
import type { StaffHutDef } from '../src/sim/stations';
import { newInteractionState, stepInteraction } from '../src/sim/systems/interaction';

const grid = parseGrid(YARD, STATIONS);
const hut = STATIONS.find((s): s is StaffHutDef => s.kind === 'staffHut')!;

/** A simulation with the player parked out of every zone, so only employees act. */
function simWith(state: GameState): Simulation {
  state.player.x = grid.playerStart.x;
  state.player.y = grid.playerStart.y;
  return new Simulation(state, grid, STATIONS, 'dump');
}

function run(sim: Simulation, seconds: number) {
  for (let i = 0; i < seconds * 4; i++) sim.advance(250);
}

function addEmployee(state: GameState, x: number, y: number) {
  state.employees.push({ id: state.employees.length, x, y, facing: 'down', stack: [] });
}

describe('pathfinding', () => {
  it('walks around walls instead of through them', () => {
    const g = parseGrid(['.....', '.~~~.', 'P....']);
    const path = findPath(g, { x: 2.5, y: 0.5 }, { x: 2.5, y: 2.5 })!;
    expect(path).toBeDefined();
    for (const p of path) expect(walkable(g, Math.floor(p.x), Math.floor(p.y))).toBe(true);
    expect(path.length).toBeGreaterThan(2);
  });

  it('does not cut corners between two blocked tiles', () => {
    const g = parseGrid(['.~', '~.', 'P.']);
    expect(findPath(g, { x: 0.5, y: 0.5 }, { x: 1.5, y: 1.5 })).toBeUndefined();
  });

  it('gives up on unreachable goals', () => {
    expect(findPath(grid, grid.playerStart, { x: 21.5, y: 11.5 })).toBeUndefined(); // inside the shredder
  });
});

describe('hiring', () => {
  function standOnHire(state: GameState, ticks: number) {
    const inter = newInteractionState();
    state.player.x = hut.zones.hire.x + 0.5;
    state.player.y = hut.zones.hire.y + 0.5;
    for (let i = 0; i < ticks; i++) stepInteraction(state, STATIONS, inter, []);
  }

  it('opens at business level 2, and gives the first employee free after the stand-still', () => {
    const state = createNewGame(grid, STATIONS);
    standOnHire(state, secondsToTicks(5));
    expect(state.employees).toHaveLength(0);
    state.earned = BUSINESS_LEVELS[STAFF.requiresLevel - 1]!;
    standOnHire(state, secondsToTicks(PURCHASE.delayS) - 1);
    expect(state.employees).toHaveLength(0);
    standOnHire(state, secondsToTicks(PURCHASE.delayS) + 2);
    expect(state.employees).toHaveLength(1);
    expect(state.money).toBe(0);
  });

  it('costs more for each later hire, takes nothing until affordable and stops at the cap', () => {
    const state = createNewGame(grid, STATIONS);
    state.earned = BUSINESS_LEVELS[STAFF.requiresLevel - 1]!;
    state.employees.push({ id: 0, x: 10.5, y: 12.5, facing: 'down', stack: [] });
    state.money = 100;
    standOnHire(state, secondsToTicks(6));
    expect(state.employees).toHaveLength(1);
    expect(state.hirePaid).toBe(0);
    expect(state.money).toBe(100);

    state.money = 100_000;
    standOnHire(state, secondsToTicks(60));
    expect(state.employees).toHaveLength(STAFF.costs.length);
    const total = STAFF.costs.reduce((a, b) => a + b, 0);
    expect(state.money).toBe(100_000 - total);
  });

  it('waits for the stand-still like every pad that spends', () => {
    const state = createNewGame(grid, STATIONS);
    state.earned = BUSINESS_LEVELS[STAFF.requiresLevel - 1]!;
    state.money = 1000;
    standOnHire(state, secondsToTicks(PURCHASE.delayS) - 1);
    expect(state.money).toBe(1000);
  });
});

describe('employees', () => {
  it('collect scrap from the dump site and feed the shredder on their own', () => {
    const state = createNewGame(grid, STATIONS);
    addEmployee(state, 10.5, 12.5);
    const sim = simWith(state);
    run(sim, 40);
    const shredder = state.processors.shredder!;
    // Fed: scrap in the hopper, being shredded, or already shredded (its metal may be in the bins by now).
    const fed = shredder.hopper + (shredder.progress > 0 ? 1 : 0) + shredder.shredded;
    expect(fed).toBeGreaterThan(0);
  });

  it('clear the shredder tray into the bins', () => {
    const state = createNewGame(grid, STATIONS);
    state.field.pieces = [];
    state.truck.timer = secondsToTicks(600); // no deliveries, so nothing new gets shredded
    state.processors.shredder!.tray.iron = 5;
    state.processors.shredder!.tray.aluminium = 2;
    addEmployee(state, 24.5, 14.5);
    run(simWith(state), 30);
    expect(state.bins['bin-iron']!.count).toBe(5);
    expect(state.bins['bin-aluminium']!.count).toBe(2);
  });

  it('load a waiting truck from the factory line, and the order pays', () => {
    const state = createNewGame(grid, STATIONS);
    state.field.pieces = [];
    Object.assign(state.lines['line-1']!, { built: true, out: 6, outItem: 'sheet' });
    Object.assign(state.bays['bay-a']!, { phase: 'waiting', timer: secondsToTicks(200), item: 'sheet', want: 4, have: 0 });
    addEmployee(state, 38.5, 16.5);
    run(simWith(state), 30);
    expect(state.money).toBeGreaterThan(0);
    expect(state.lines['line-1']!.out).toBeLessThanOrEqual(2);
  });

  it('never chase the same piece', () => {
    const state = createNewGame(grid, STATIONS);
    state.field.pieces = [{ id: 1, x: 10.5, y: 10.5, kind: 0 }];
    addEmployee(state, 8.5, 12.5);
    addEmployee(state, 12.5, 12.5);
    const sim = simWith(state);
    sim.advance(50);
    const targets = [...sim.brains.values()].map((b) => b.target).filter((t) => t?.kind === 'piece');
    expect(targets).toHaveLength(1);
  });

  it('never spend money', () => {
    const state = createNewGame(grid, STATIONS);
    state.money = 5000;
    for (let i = 0; i < 4; i++) addEmployee(state, 10.5 + i, 12.5);
    run(simWith(state), 60);
    expect(state.money).toBeGreaterThanOrEqual(5000);
    expect(state.upgrades.carry).toBe(0);
    expect(state.employees).toHaveLength(4);
  });

  it('keep the shredder going when the iron bin is full, by selling the overflow at the Scrap Dealer', () => {
    const state = createNewGame(grid, STATIONS);
    state.field.pieces = [];
    state.truck.timer = secondsToTicks(600);
    state.bins['bin-iron']!.count = 30;
    const shredder = state.processors.shredder!;
    shredder.tray.iron = 11;
    shredder.hopper = 6;
    state.upgrades.staffCarry = 3;
    addEmployee(state, 24.5, 14.5);
    const sold: SimEvent[] = [];
    const drained: SimEvent[] = [];
    const sim = simWith(state);
    for (let i = 0; i < 4 * 60; i++) {
      sim.advance(250);
      sold.push(...sim.drainEvents(drained).filter((e) => e.type === 'sold'));
    }
    expect(shredder.hopper).toBe(0);
    expect(shredder.progress).toBe(0);
    expect(sold.length).toBeGreaterThan(0);
    expect(sold.every((e) => e.type === 'sold' && e.station === 'dealer')).toBe(true);
    expect(state.money).toBeGreaterThan(0);
    expect(state.bins['bin-iron']!.count).toBe(30);
  });

  it('clear a line stuck on old products by selling them at the stall', () => {
    const state = createNewGame(grid, STATIONS);
    state.field.pieces = [];
    state.truck.timer = secondsToTicks(600);
    state.earned = 1e9;
    Object.assign(state.lines['line-1']!, { built: true, product: 'can', out: 3, outItem: 'sheet' });
    addEmployee(state, 38.5, 17.5);
    run(simWith(state), 40);
    expect(state.lines['line-1']!.out).toBe(0);
    expect(state.money).toBeGreaterThan(0);
  });
});

describe('save v9 → v10', () => {
  it('adds an empty staff', () => {
    const store = memoryStorage();
    const v9 = structuredClone(createNewGame(grid, STATIONS)) as unknown as Record<string, any>;
    delete v9.employees;
    delete v9.hirePaid;
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 9, savedAt: 0, state: v9 }));
    const loaded = new SaveManager(store, isGameState).load();
    expect(loaded).not.toBeNull();
    const state = sanitizeState(loaded!.state, grid, STATIONS);
    expect(state.employees).toEqual([]);
    expect(state.hirePaid).toBe(0);
  });
});

describe('staff upgrades', () => {
  it('start employees slower than the player with small hands, and grow both per level', () => {
    const state = createNewGame(grid, STATIONS);
    expect(staffSpeed(state)).toBeLessThan(PLAYER.speed / 2 + 0.01);
    expect(staffCapacity(state)).toBe(STAFF.capacity);
    state.upgrades.staffSpeed = UPGRADES.staffSpeed.maxLevel;
    state.upgrades.staffCarry = UPGRADES.staffCarry.maxLevel;
    expect(staffSpeed(state)).toBeCloseTo(STAFF.speed + UPGRADE_EFFECTS.staffSpeedPerLevel * UPGRADES.staffSpeed.maxLevel);
    expect(staffCapacity(state)).toBe(STAFF.capacity + UPGRADES.staffCarry.maxLevel);
  });

  it('let an employee carry more per trip once upgraded', () => {
    const run = (carry: number) => {
      const state = createNewGame(grid, STATIONS);
      state.upgrades.staffCarry = carry;
      state.field.pieces = [];
      state.truck.timer = secondsToTicks(600);
      state.processors.shredder!.tray.iron = 8;
      addEmployee(state, 24.5, 14.5);
      const sim = simWith(state);
      let most = 0;
      for (let i = 0; i < 80; i++) {
        sim.advance(250);
        most = Math.max(most, state.employees[0]!.stack.length);
      }
      return most;
    };
    expect(run(0)).toBe(STAFF.capacity);
    expect(run(3)).toBe(STAFF.capacity + 3);
  });
});

describe('save v11 → v12', () => {
  it('adds the staff upgrades at level 0', () => {
    const store = memoryStorage();
    const v11 = structuredClone(createNewGame(grid, STATIONS)) as unknown as Record<string, any>;
    for (const key of ['upgrades', 'upgradePaid']) {
      delete v11[key].staffSpeed;
      delete v11[key].staffCarry;
    }
    v11.upgrades.carry = 2;
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 11, savedAt: 0, state: v11 }));
    const loaded = new SaveManager(store, isGameState).load();
    expect(loaded).not.toBeNull();
    const state = sanitizeState(loaded!.state, grid, STATIONS);
    expect(state.upgrades).toMatchObject({ carry: 2, staffSpeed: 0, staffCarry: 0 });
  });
});
