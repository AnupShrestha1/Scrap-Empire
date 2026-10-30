import { describe, expect, it } from 'vitest';
import { CARRY, PILE, PRICES, SHREDDER, SUPPLIER } from '../src/data/balance';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { createNewGame, secondsToTicks, type GameState } from '../src/sim/state';
import type { StationDef } from '../src/sim/stations';
import { newInteractionState, stepInteraction } from '../src/sim/systems/interaction';
import { processorStatus, stepProcessor, trayTotal } from '../src/sim/systems/processing';
import { stepSupplier } from '../src/sim/systems/supplier';

// A tiny yard: pile, shredder and an iron bin side by side, each with a one-tile zone.
const STATIONS: StationDef[] = [
  {
    id: 'pile',
    kind: 'pile',
    capacity: 20,
    rect: { x: 0, y: 0, w: 1, h: 1 },
    zones: { take: { x: 0, y: 1, w: 1, h: 1 }, return: { x: 1, y: 0, w: 1, h: 1 } },
  },
  {
    id: 'shredder',
    kind: 'processor',
    recipe: SHREDDER,
    rect: { x: 2, y: 0, w: 1, h: 1 },
    zones: { input: { x: 2, y: 1, w: 1, h: 1 }, output: { x: 3, y: 1, w: 1, h: 1 } },
  },
  {
    id: 'bin',
    kind: 'bin',
    item: 'iron',
    capacity: 3,
    rect: { x: 5, y: 0, w: 1, h: 1 },
    zones: { deposit: { x: 5, y: 1, w: 1, h: 1 }, sell: { x: 4, y: 0, w: 1, h: 1 } },
  },
];
const grid = parseGrid(['......', 'P.....'], STATIONS);
const [pileDef, shredderDef] = STATIONS as [Extract<StationDef, { kind: 'pile' }>, Extract<StationDef, { kind: 'processor' }>];

function standIn(state: GameState, x: number, ticks: number, events: SimEvent[] = [], y = 1) {
  const inter = newInteractionState();
  state.player.x = x + 0.5;
  state.player.y = y + 0.5;
  for (let i = 0; i < ticks; i++) stepInteraction(state, STATIONS, inter, events);
  return events;
}

describe('carrying', () => {
  it('takes scrap from the pile up to carry capacity, at the transfer rate', () => {
    const state = createNewGame(grid, STATIONS);
    standIn(state, 0, 1);
    expect(state.player.stack).toEqual(['scrap']);
    standIn(state, 0, 100);
    expect(state.player.stack).toHaveLength(CARRY.capacity);
    expect(state.piles.pile!.items).toBe(PILE.startItems - CARRY.capacity);
  });

  it('feeds only the input item into the hopper', () => {
    const state = createNewGame(grid, STATIONS);
    state.player.stack = ['iron', 'scrap', 'scrap'];
    standIn(state, 2, 40);
    expect(state.processors.shredder!.hopper).toBe(2);
    expect(state.player.stack).toEqual(['iron']);
  });

  it('collects the output tray and sorts only matching items into a bin', () => {
    const state = createNewGame(grid, STATIONS);
    state.processors.shredder!.tray.iron = 2;
    state.processors.shredder!.tray.aluminium = 1;
    standIn(state, 3, 40);
    expect(state.player.stack.sort()).toEqual(['aluminium', 'iron', 'iron']);
    standIn(state, 5, 40);
    expect(state.bins.bin!.count).toBe(2);
    expect(state.player.stack).toEqual(['aluminium']);
  });

  it('warns once when a bin is full and keeps the items on the player', () => {
    const state = createNewGame(grid, STATIONS);
    state.bins.bin!.count = 3;
    state.player.stack = ['iron', 'iron'];
    const events = standIn(state, 5, 40);
    expect(state.player.stack).toEqual(['iron', 'iron']);
    expect(events.filter((e) => e.type === 'storageFull')).toHaveLength(1);
  });
});

describe('selling', () => {
  it('sells a bin empty for cash, one item at a time', () => {
    const state = createNewGame(grid, STATIONS);
    state.bins.bin!.count = 3;
    const events = standIn(state, 4, 40, [], 0);
    expect(state.bins.bin!.count).toBe(0);
    expect(state.money).toBe(3 * PRICES.iron);
    expect(events.filter((e) => e.type === 'sold')).toHaveLength(3);
  });
});

describe('getting unstuck', () => {
  it('can always free full hands by returning scrap, even past the pile limit', () => {
    // The deadlock: hands full of scrap, hopper full, tray full.
    const state = createNewGame(grid, STATIONS);
    const machine = state.processors.shredder!;
    state.player.stack = Array(CARRY.capacity).fill('scrap');
    machine.hopper = SHREDDER.hopper;
    machine.tray.iron = SHREDDER.tray;
    state.piles.pile!.items = pileDef.capacity;

    standIn(state, 1, 40, [], 0);
    expect(state.player.stack).toEqual([]);
    expect(state.piles.pile!.items).toBe(pileDef.capacity + CARRY.capacity);

    standIn(state, 3, 40);
    expect(state.player.stack).toHaveLength(CARRY.capacity);
    expect(machine.tray.iron).toBe(SHREDDER.tray - CARRY.capacity);
  });

  it('can always empty hands full of metal, even with the bin full, by selling first', () => {
    const state = createNewGame(grid, STATIONS);
    state.player.stack = Array(CARRY.capacity).fill('iron');
    state.bins.bin!.count = 3;
    state.processors.shredder!.tray.iron = SHREDDER.tray;

    standIn(state, 5, 40);
    expect(state.player.stack).toHaveLength(CARRY.capacity);
    standIn(state, 4, 40, [], 0);
    standIn(state, 5, 40);
    expect(state.player.stack.length).toBeLessThan(CARRY.capacity);
  });

  it('gives every item the player can carry somewhere to go', () => {
    // Each carried item must have a zone that always accepts it, given enough selling.
    for (const item of ['scrap', 'iron'] as const) {
      const state = createNewGame(grid, STATIONS);
      state.player.stack = [item];
      state.piles.pile!.items = 999;
      state.bins.bin!.count = 3;
      state.processors.shredder!.hopper = SHREDDER.hopper;
      standIn(state, 1, 10, [], 0);
      standIn(state, 4, 10, [], 0);
      standIn(state, 5, 10);
      expect(state.player.stack).toEqual([]);
    }
  });
});

describe('processing', () => {
  it('turns scrap into exactly 1 iron and 0.3 aluminium each, over time', () => {
    const state = createNewGame(grid, STATIONS);
    const machine = state.processors.shredder!;
    machine.hopper = 10;
    for (let i = 0; i < 10 * secondsToTicks(SHREDDER.cycleS) + 20; i++) {
      stepProcessor(shredderDef, machine);
      if (trayTotal(machine) >= 10) {
        // Empty the tray as a player would, so it never blocks.
        state.bins.bin!.count += machine.tray.iron;
        machine.tray.iron = 0;
      }
    }
    expect(state.bins.bin!.count + machine.tray.iron).toBe(10);
    expect(machine.tray.aluminium).toBe(3);
    expect(processorStatus(shredderDef, machine)).not.toBe('processing');
  });

  it('blocks with a full tray and resumes once it is emptied', () => {
    const state = createNewGame(grid, STATIONS);
    const machine = state.processors.shredder!;
    machine.tray.iron = SHREDDER.tray;
    machine.hopper = 1;
    for (let i = 0; i < secondsToTicks(SHREDDER.cycleS) + 5; i++) stepProcessor(shredderDef, machine);
    expect(processorStatus(shredderDef, machine)).toBe('blocked');
    expect(machine.tray.iron).toBe(SHREDDER.tray);
    machine.tray.iron = 0;
    stepProcessor(shredderDef, machine);
    expect(machine.tray.iron).toBe(1);
    expect(processorStatus(shredderDef, machine)).toBe('ready');
  });
});

describe('supplier truck', () => {
  it('arrives, unloads its whole load onto the pile, and leaves', () => {
    const state = createNewGame(grid, STATIONS);
    state.piles.pile!.items = 0;
    const events: SimEvent[] = [];
    const ticks = secondsToTicks(SUPPLIER.firstDeliveryS + SUPPLIER.driveInS + SUPPLIER.load / SUPPLIER.unloadPerS + 1);
    for (let i = 0; i < ticks; i++) stepSupplier(state.truck, pileDef, state.piles.pile!, events);
    expect(state.piles.pile!.items).toBe(SUPPLIER.load);
    expect(state.truck.phase).toBe('leaving');
    expect(events.map((e) => e.type)).toContain('truckArriving');
  });

  it('waits at the gate while the pile is full', () => {
    const state = createNewGame(grid, STATIONS);
    state.piles.pile!.items = pileDef.capacity - 2;
    const events: SimEvent[] = [];
    for (let i = 0; i < secondsToTicks(20); i++) stepSupplier(state.truck, pileDef, state.piles.pile!, events);
    expect(state.truck.phase).toBe('waiting');
    expect(state.truck.load).toBe(SUPPLIER.load - 2);
    state.piles.pile!.items = 0;
    for (let i = 0; i < secondsToTicks(5); i++) stepSupplier(state.truck, pileDef, state.piles.pile!, events);
    expect(state.truck.phase).not.toBe('waiting');
    expect(state.piles.pile!.items).toBe(SUPPLIER.load - 2);
  });
});
