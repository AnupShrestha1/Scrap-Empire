import { describe, expect, it } from 'vitest';
import { CARRY, FIELD, PRICES, SHREDDER, SUPPLIER } from '../src/data/balance';
import { BIG_KINDS, PIECE_KINDS, SMALL_KINDS } from '../src/data/scrap';
import { PURCHASE } from '../src/data/upgrades';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { createNewGame, secondsToTicks, type GameState } from '../src/sim/state';
import type { DumpDef, ProcessorDef, StationDef } from '../src/sim/stations';
import { dropStack, fieldUnits, stepField } from '../src/sim/systems/field';
import { newInteractionState, stepInteraction } from '../src/sim/systems/interaction';
import { processorStatus, stepProcessor, trayTotal } from '../src/sim/systems/processing';
import { stepSupplier } from '../src/sim/systems/supplier';

// A tiny yard: a 3×3 dump site with its drop pad below, a shredder, and an iron bin with a sell pad.
const DUMP: DumpDef = {
  id: 'dump',
  kind: 'dump',
  capacity: 20,
  rect: { x: 0, y: 0, w: 3, h: 3 },
  zones: { field: { x: 0, y: 0, w: 3, h: 3 }, return: { x: 0, y: 3, w: 1, h: 1 } },
};
const SHRED: ProcessorDef = {
  id: 'shredder',
  kind: 'processor',
  recipe: SHREDDER,
  rect: { x: 4, y: 0, w: 1, h: 1 },
  zones: { input: { x: 4, y: 1, w: 1, h: 1 }, output: { x: 5, y: 1, w: 1, h: 1 } },
};
const STATIONS: StationDef[] = [
  DUMP,
  SHRED,
  {
    id: 'bin',
    kind: 'bin',
    item: 'iron',
    capacity: 3,
    rect: { x: 7, y: 0, w: 1, h: 1 },
    zones: { deposit: { x: 7, y: 1, w: 1, h: 1 }, sell: { x: 6, y: 0, w: 1, h: 1 } },
  },
];
const grid = parseGrid(['.........', '.........', '.........', 'P........'], STATIONS);
const DT = 0.05;

function emptyGame(): GameState {
  const state = createNewGame(grid, STATIONS);
  state.field.pieces = [];
  return state;
}

function standIn(state: GameState, x: number, ticks: number, events: SimEvent[] = [], y = 1) {
  const inter = newInteractionState();
  state.player.x = x + 0.5;
  state.player.y = y + 0.5;
  for (let i = 0; i < ticks; i++) stepInteraction(state, STATIONS, inter, events);
  return events;
}

function placePiece(state: GameState, x: number, y: number, kind = SMALL_KINDS[0]!) {
  state.field.pieces.push({ id: state.field.nextId++, x, y, kind });
}

describe('the dump site', () => {
  it('starts a new game with scrap scattered across it', () => {
    const state = createNewGame(grid, STATIONS);
    expect(fieldUnits(state.field)).toBeGreaterThanOrEqual(FIELD.startUnits);
    for (const p of state.field.pieces) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(3);
      expect(p.y).toBeLessThan(3);
    }
  });

  it('scatters the same way every time from the same seed', () => {
    const a = createNewGame(grid, STATIONS).field.pieces;
    const b = createNewGame(grid, STATIONS).field.pieces;
    expect(a).toEqual(b);
  });

  it('picks up a piece the player walks onto', () => {
    const state = emptyGame();
    placePiece(state, 1.5, 1.5);
    state.player.x = 1.5;
    state.player.y = 1.5;
    const events: SimEvent[] = [];
    stepField(state, DUMP, DT, events);
    expect(state.player.stack).toEqual(['scrap']);
    expect(state.field.pieces).toEqual([]);
    expect(events).toContainEqual(expect.objectContaining({ type: 'pickedUp', units: 1 }));
  });

  it('pulls nearby pieces in (the magnet) and leaves distant ones alone', () => {
    const state = emptyGame();
    placePiece(state, 1.5 + FIELD.magnetRadius * 0.8, 1.5);
    placePiece(state, 1.5 + FIELD.magnetRadius * 1.5, 1.5);
    state.player.x = 1.5;
    state.player.y = 1.5;
    for (let i = 0; i < 20; i++) stepField(state, DUMP, DT, []);
    expect(state.player.stack).toEqual(['scrap']);
    expect(state.field.pieces).toHaveLength(1);
    expect(state.field.pieces[0]!.x).toBeCloseTo(1.5 + FIELD.magnetRadius * 1.5);
  });

  it('counts a big piece as 3 scrap that needs 3 free slots', () => {
    const state = emptyGame();
    placePiece(state, 1.5, 1.5, BIG_KINDS[0]);
    state.player.x = 1.5;
    state.player.y = 1.5;
    state.player.stack = Array(CARRY.capacity - 2).fill('iron');
    stepField(state, DUMP, DT, []);
    expect(state.field.pieces).toHaveLength(1);
    state.player.stack = [];
    stepField(state, DUMP, DT, []);
    expect(state.player.stack).toEqual(['scrap', 'scrap', 'scrap']);
    expect(PIECE_KINDS[BIG_KINDS[0]!]!.units).toBe(3);
  });

  it('gets its scrap from the truck, which tips the whole load and leaves', () => {
    const state = emptyGame();
    const events: SimEvent[] = [];
    const ticks = secondsToTicks(SUPPLIER.firstDeliveryS + SUPPLIER.driveInS + 4);
    for (let i = 0; i < ticks; i++) stepSupplier(state, DUMP, events);
    expect(fieldUnits(state.field)).toBeGreaterThanOrEqual(SUPPLIER.load);
    expect(state.truck.phase).toBe('leaving');
  });

  it('makes the truck wait while the field is full', () => {
    const state = emptyGame();
    for (let i = 0; i < DUMP.capacity; i++) placePiece(state, 1, 1);
    for (let i = 0; i < secondsToTicks(20); i++) stepSupplier(state, DUMP, []);
    expect(state.truck.phase).toBe('waiting');
    state.field.pieces = [];
    for (let i = 0; i < secondsToTicks(5); i++) stepSupplier(state, DUMP, []);
    expect(state.field.pieces.length).toBeGreaterThan(0);
  });

  it('takes scrap back on the drop pad, but only after standing still', () => {
    const state = emptyGame();
    state.player.stack = ['scrap', 'scrap', 'iron'];
    standIn(state, 0, secondsToTicks(PURCHASE.returnDelayS) - 1, [], 3);
    expect(state.player.stack).toHaveLength(3);
    standIn(state, 0, secondsToTicks(3), [], 3);
    expect(state.player.stack).toEqual(['iron']);
    expect(state.field.pieces).toHaveLength(2);
  });
});

describe('carrying', () => {
  it('feeds only the input item into the hopper', () => {
    const state = emptyGame();
    state.player.stack = ['iron', 'scrap', 'scrap'];
    standIn(state, 4, 40);
    expect(state.processors.shredder!.hopper).toBe(2);
    expect(state.player.stack).toEqual(['iron']);
  });

  it('collects the output tray and sorts only matching items into a bin', () => {
    const state = emptyGame();
    state.processors.shredder!.tray.iron = 2;
    state.processors.shredder!.tray.aluminium = 1;
    standIn(state, 5, 40);
    expect([...state.player.stack].sort()).toEqual(['aluminium', 'iron', 'iron']);
    standIn(state, 7, 40);
    expect(state.bins.bin!.count).toBe(2);
    expect(state.player.stack).toEqual(['aluminium']);
  });

  it('warns once when a bin is full and keeps the items on the player', () => {
    const state = emptyGame();
    state.bins.bin!.count = 3;
    state.player.stack = ['iron', 'iron'];
    const events = standIn(state, 7, 40);
    expect(state.player.stack).toEqual(['iron', 'iron']);
    expect(events.filter((e) => e.type === 'storageFull')).toHaveLength(1);
  });
});

describe('selling', () => {
  it('sells a bin empty for cash, one item at a time, after a stand-still', () => {
    const state = emptyGame();
    state.bins.bin!.count = 3;
    const events = standIn(state, 6, 60, [], 0);
    expect(state.bins.bin!.count).toBe(0);
    expect(state.money).toBe(3 * PRICES.iron);
    expect(events.filter((e) => e.type === 'sold')).toHaveLength(3);
  });
});

describe('getting unstuck', () => {
  it('can always free hands full of scrap, even with the shredder and field full', () => {
    const state = emptyGame();
    const machine = state.processors.shredder!;
    state.player.stack = Array(CARRY.capacity).fill('scrap');
    machine.hopper = SHREDDER.hopper;
    machine.tray.iron = SHREDDER.tray;
    for (let i = 0; i < DUMP.capacity; i++) placePiece(state, 2.5, 2.5);

    standIn(state, 0, secondsToTicks(4), [], 3);
    expect(state.player.stack).toEqual([]);
    expect(state.field.pieces).toHaveLength(DUMP.capacity + CARRY.capacity);

    standIn(state, 5, 40);
    expect(state.player.stack).toHaveLength(CARRY.capacity);
  });

  it('can always empty hands full of metal, even with the bin full, by selling first', () => {
    const state = emptyGame();
    state.player.stack = Array(CARRY.capacity).fill('iron');
    state.bins.bin!.count = 3;
    standIn(state, 7, 40);
    expect(state.player.stack).toHaveLength(CARRY.capacity);
    standIn(state, 6, 60, [], 0);
    standIn(state, 7, 40);
    expect(state.player.stack.length).toBeLessThan(CARRY.capacity);
  });
});

describe('processing', () => {
  it('turns scrap into exactly the recipe outputs, over time', () => {
    const state = emptyGame();
    const machine = state.processors.shredder!;
    machine.hopper = 10;
    let iron = 0;
    for (let i = 0; i < 10 * secondsToTicks(SHREDDER.cycleS) + 20; i++) {
      stepProcessor(SHRED, machine);
      iron += machine.tray.iron;
      machine.tray.iron = 0;
    }
    expect(iron).toBe(Math.floor(10 * SHREDDER.outputs.iron! + 1e-9));
    expect(machine.tray.aluminium).toBe(Math.floor(10 * SHREDDER.outputs.aluminium! + 1e-9));
  });

  it('blocks with a full tray and resumes once it is emptied', () => {
    const state = emptyGame();
    const machine = state.processors.shredder!;
    machine.tray.iron = SHREDDER.tray;
    machine.hopper = 1;
    // Enough iron carried over that this scrap finishes a whole one, whatever the recipe's share.
    machine.carry.iron = 1 - SHREDDER.outputs.iron! + 0.01;
    for (let i = 0; i < secondsToTicks(SHREDDER.cycleS) + 5; i++) stepProcessor(SHRED, machine);
    expect(processorStatus(SHRED, machine)).toBe('blocked');
    machine.tray.iron = 0;
    stepProcessor(SHRED, machine);
    expect(machine.tray.iron).toBe(1);
    expect(trayTotal(machine)).toBe(1);
  });
});

describe('the Drop button', () => {
  it('drops everything carried around the player, then lets it be picked up again', () => {
    const state = emptyGame();
    state.player.x = 1.5;
    state.player.y = 1.5;
    state.player.stack = ['scrap', 'iron', 'iron'];
    const events: SimEvent[] = [];
    expect(dropStack(state, grid, events)).toBe(true);
    expect(state.player.stack).toEqual([]);
    expect(state.field.pieces).toHaveLength(3);
    expect(events).toContainEqual({ type: 'dropped', count: 3 });
    for (const p of state.field.pieces) expect(Math.hypot(p.x - 1.5, p.y - 1.5)).toBeLessThanOrEqual(FIELD.dropSpread + 1e-9);

    // Standing still, the magnet leaves them alone however long the player waits...
    for (let i = 0; i < 200; i++) stepField(state, DUMP, DT, []);
    expect(state.player.stack).toEqual([]);
    // ...until the player walks out of reach and comes back; then they're collected as what they were.
    state.player.x = 8.5;
    stepField(state, DUMP, DT, []);
    state.player.x = 1.5;
    for (let i = 0; i < 40; i++) stepField(state, DUMP, DT, []);
    expect([...state.player.stack].sort()).toEqual(['iron', 'iron', 'scrap']);
  });

  it('never drops anything inside a wall or machine', () => {
    const state = emptyGame();
    // Right next to the shredder (solid at x 4..5, y 0..1).
    state.player.x = 3.7;
    state.player.y = 0.5;
    state.player.stack = Array(CARRY.capacity).fill('scrap');
    dropStack(state, grid, []);
    for (const p of state.field.pieces) expect(p.x < 4 || p.x >= 5 || p.y >= 1).toBe(true);
  });

  it('does nothing with empty hands', () => {
    const state = emptyGame();
    expect(dropStack(state, grid, [])).toBe(false);
    expect(state.field.pieces).toEqual([]);
  });
});
