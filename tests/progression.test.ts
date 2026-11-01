import { describe, expect, it } from 'vitest';
import { CARRY, SHREDDER, SUPPLIER } from '../src/data/balance';
import { STATIONS, YARD } from '../src/data/layout';
import { OBJECTIVES } from '../src/data/objectives';
import { currentObjective } from '../src/sim/systems/objectives';
import { PURCHASE, UPGRADE_EFFECTS, UPGRADES, upgradeCost } from '../src/data/upgrades';
import { memoryStorage } from '../src/platform/memoryStorage';
import { SAVE_KEYS, SaveManager } from '../src/save/saveManager';
import { carryCapacity, processorCycleTicks, supplyIntervalS, supplyLoad } from '../src/sim/effective';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { createNewGame, isGameState, sanitizeState, secondsToTicks, type GameState } from '../src/sim/state';
import type { ProcessorDef } from '../src/sim/stations';
import { newInteractionState, stepInteraction } from '../src/sim/systems/interaction';
import { stepObjectives } from '../src/sim/systems/objectives';

const grid = parseGrid(YARD, STATIONS);
const shredder = STATIONS.find((s): s is ProcessorDef => s.kind === 'processor')!;
const carryPad = STATIONS.find((s) => s.id === 'pad-carry')!;

/** Stands on the carry pad for up to `ticks`, stopping early once `until` holds. */
function standOnCarryPad(state: GameState, ticks: number, events: SimEvent[] = [], until = () => false) {
  const inter = newInteractionState();
  state.player.x = carryPad.rect.x + 0.5;
  state.player.y = carryPad.rect.y + 0.5;
  for (let i = 0; i < ticks && !until(); i++) stepInteraction(state, STATIONS, inter, events);
  return events;
}

describe('upgrade effects', () => {
  it('raise carry capacity, shredder speed and supply as levels rise', () => {
    const state = createNewGame(grid, STATIONS);
    expect(carryCapacity(state)).toBe(CARRY.capacity);
    state.upgrades.carry = 2;
    expect(carryCapacity(state)).toBe(CARRY.capacity + 2 * UPGRADE_EFFECTS.carryPerLevel);

    const base = processorCycleTicks(shredder, state);
    state.upgrades.shredderSpeed = 3;
    expect(processorCycleTicks(shredder, state)).toBeLessThan(base);

    state.upgrades.supply = 1;
    expect(supplyLoad(state)).toBe(SUPPLIER.load + UPGRADE_EFFECTS.supplyLoadPerStep);
    expect(supplyIntervalS(state)).toBe(SUPPLIER.intervalS);
    state.upgrades.supply = 2;
    expect(supplyIntervalS(state)).toBe(SUPPLIER.intervalS - UPGRADE_EFFECTS.supplyIntervalPerStepS);
    state.upgrades.supply = 99;
    expect(supplyIntervalS(state)).toBe(UPGRADE_EFFECTS.supplyMinIntervalS);
  });

  it('cost more each level', () => {
    expect(upgradeCost('carry', 0)).toBe(UPGRADES.carry.cost);
    expect(upgradeCost('carry', 1)).toBeGreaterThan(upgradeCost('carry', 0));
  });
});

describe('cash pads', () => {
  it('ignore the player walking straight across', () => {
    const state = createNewGame(grid, STATIONS);
    state.money = 100;
    standOnCarryPad(state, secondsToTicks(PURCHASE.delayS) - 1);
    expect(state.money).toBe(100);
  });

  it('take payment over time and apply the upgrade when paid', () => {
    const state = createNewGame(grid, STATIONS);
    state.money = 100;
    const events = standOnCarryPad(state, secondsToTicks(PURCHASE.delayS + PURCHASE.payS) + 2, [], () => state.upgrades.carry === 1);
    expect(state.upgrades.carry).toBe(1);
    expect(state.money).toBe(100 - UPGRADES.carry.cost);
    expect(events.some((e) => e.type === 'upgraded')).toBe(true);
  });

  it('take no money until the player can pay the whole price', () => {
    const state = createNewGame(grid, STATIONS);
    state.money = UPGRADES.carry.cost - 1;
    const events = standOnCarryPad(state, secondsToTicks(5));
    expect(state.money).toBe(UPGRADES.carry.cost - 1);
    expect(state.upgradePaid.carry).toBe(0);
    expect(state.upgrades.carry).toBe(0);
    expect(events.filter((e) => e.type === 'needCash')).toEqual([{ type: 'needCash', amount: UPGRADES.carry.cost }]);

    state.money = 100;
    standOnCarryPad(state, secondsToTicks(PURCHASE.delayS + PURCHASE.payS) + 2, [], () => state.upgrades.carry === 1);
    expect(state.upgrades.carry).toBe(1);
    expect(state.money).toBe(100 - UPGRADES.carry.cost);
  });

  it('keep buying the next level after a pause while the player stays', () => {
    const state = createNewGame(grid, STATIONS);
    state.money = 1000;
    standOnCarryPad(state, secondsToTicks(10));
    expect(state.upgrades.carry).toBeGreaterThan(1);
  });

  it('stop at the maximum level', () => {
    const state = createNewGame(grid, STATIONS);
    state.upgrades.carry = UPGRADES.carry.maxLevel;
    state.money = 10_000;
    standOnCarryPad(state, secondsToTicks(5));
    expect(state.money).toBe(10_000);
  });
});

describe('objectives', () => {
  it('advance on matching events and pay their reward', () => {
    const state = createNewGame(grid, STATIONS);
    const out: SimEvent[] = [];
    stepObjectives(state, [{ type: 'itemMoved', item: 'scrap', from: 'truck', to: 'pile' }], out);
    expect(state.objectives.index).toBe(0);
    stepObjectives(state, [{ type: 'itemMoved', item: 'scrap', from: 'dump', to: 'player' }], out);
    expect(state.objectives.index).toBe(1);
    expect(state.money).toBe(OBJECTIVES[0]!.reward);
    expect(out).toContainEqual({ type: 'objectiveDone', objective: 'pickScrap', reward: OBJECTIVES[0]!.reward });
  });

  it('skip objectives that are already done, such as an upgrade bought early', () => {
    const state = createNewGame(grid, STATIONS);
    state.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'buyCarry');
    state.upgrades.carry = 1;
    stepObjectives(state, [], []);
    expect(OBJECTIVES[state.objectives.index]?.id).toBe('shred20');
  });

  it('count shredded scrap through a real processing cycle', () => {
    const state = createNewGame(grid, STATIONS);
    state.objectives.index = OBJECTIVES.findIndex((o) => o.id === 'shred20');
    const events: SimEvent[] = [{ type: 'processed', station: 'shredder', item: SHREDDER.input }];
    stepObjectives(state, events, []);
    expect(state.objectives.progress).toBe(1);
  });
});

describe('save v3 → v4', () => {
  it('keeps cash and adds upgrades and objectives', () => {
    const store = memoryStorage();
    const v3 = { ...createNewGame(grid, STATIONS), money: 42 } as Record<string, unknown>;
    for (const key of ['earned', 'upgrades', 'upgradePaid', 'objectives']) delete v3[key];
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 3, savedAt: 0, state: v3 }));

    const loaded = new SaveManager(store, isGameState).load();
    expect(loaded).not.toBeNull();
    const state = sanitizeState(loaded!.state, grid, STATIONS);
    expect(state.money).toBe(42);
    expect(state.earned).toBe(42);
    expect(state.upgrades.carry).toBe(0);
    expect(state.upgrades.extraction).toBe(0);
    expect(state.objectives).toEqual({ index: 0, progress: 0 });
  });
});

describe('rotating goals', () => {
  it('follow the objective chain, growing each round', () => {
    const state = createNewGame(grid, STATIONS);
    state.objectives.index = OBJECTIVES.length;
    const first = currentObjective(state)!;
    expect(first.id).toBe('goalOrders');
    state.objectives.index = OBJECTIVES.length + 4;
    const again = currentObjective(state)!;
    expect(again.id).toBe('goalOrders');
    expect(again.target).toBeGreaterThan(first.target);
    expect(again.reward).toBeGreaterThan(first.reward);
  });
});
