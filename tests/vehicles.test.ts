import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/player';
import { STATIONS, TRUCK_ROUTE, YARD } from '../src/data/layout';
import { parseGrid } from '../src/sim/grid';
import { Simulation } from '../src/sim/simulation';
import { createNewGame, secondsToTicks } from '../src/sim/state';
import type { BayDef } from '../src/sim/stations';
import { bayTruckY, SUPPLIER_TRUCK_Y } from '../src/sim/vehicles';

const grid = parseGrid(YARD, STATIONS);
const bay = STATIONS.find((s): s is BayDef => s.id === 'bay-a')!;

function walk(sim: Simulation, dx: number, dy: number, seconds: number) {
  sim.setMoveInput(dx, dy);
  for (let i = 0; i < seconds * 4; i++) sim.advance(250);
}

describe('trucks', () => {
  it('block the player while parked at a bay', () => {
    const state = createNewGame(grid, STATIONS);
    Object.assign(state.bays['bay-a']!, { phase: 'waiting', timer: secondsToTicks(500), item: 'sheet', want: 4, have: 0 });
    state.player.x = bay.lane.parkX - 1.5;
    state.player.y = bayTruckY(bay);
    const sim = new Simulation(state, grid, STATIONS, 'dump');
    walk(sim, 1, 0, 2);
    expect(state.player.x).toBeLessThanOrEqual(bay.lane.parkX - PLAYER.halfSize);
  });

  it('let the player walk through an empty lane', () => {
    const state = createNewGame(grid, STATIONS);
    state.player.x = bay.lane.parkX - 1.5;
    state.player.y = bayTruckY(bay);
    const sim = new Simulation(state, grid, STATIONS, 'dump');
    walk(sim, 1, 0, 1);
    expect(state.player.x).toBeGreaterThan(bay.lane.parkX + 1);
  });

  it('never trap a player the supplier truck parks over', () => {
    const state = createNewGame(grid, STATIONS);
    Object.assign(state.truck, { phase: 'waiting', timer: secondsToTicks(500) });
    state.player.x = TRUCK_ROUTE.parkX + 1.5;
    state.player.y = SUPPLIER_TRUCK_Y;
    const sim = new Simulation(state, grid, STATIONS, 'dump');
    walk(sim, 0, 1, 1);
    expect(state.player.y).toBeGreaterThan(SUPPLIER_TRUCK_Y + 1);
  });
});
