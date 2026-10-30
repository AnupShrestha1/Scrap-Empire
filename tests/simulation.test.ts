import { describe, expect, it } from 'vitest';
import { SIM } from '../src/config';
import { YARD } from '../src/data/layout';
import { parseGrid } from '../src/sim/grid';
import { Simulation } from '../src/sim/simulation';
import { createNewGame } from '../src/sim/state';

const grid = parseGrid(YARD);

function newSim(): Simulation {
  const sim = new Simulation(createNewGame(grid), grid);
  sim.setMoveInput(1, 0.5);
  return sim;
}

describe('Simulation', () => {
  it('produces the same result whatever the frame rate', () => {
    const at60 = newSim();
    while (at60.state.tick < SIM.tickRate) at60.advance(1000 / 60);
    const at144 = newSim();
    while (at144.state.tick < SIM.tickRate) at144.advance(1000 / 144);

    expect(at144.state.tick).toBe(at60.state.tick);
    expect(at144.state.player.x).toBeCloseTo(at60.state.player.x, 9);
    expect(at144.state.player.y).toBeCloseTo(at60.state.player.y, 9);
  });

  it('caps how much time one frame can simulate', () => {
    const sim = newSim();
    expect(sim.advance(10_000)).toBe((SIM.maxFrameMs * SIM.tickRate) / 1000);
    expect(sim.advance(-50)).toBe(0);
  });

  it('keeps the previous tick position and a 0..1 alpha for interpolation', () => {
    const sim = newSim();
    sim.advance(75);
    expect(sim.state.tick).toBe(1);
    expect(sim.alpha).toBeCloseTo(0.5);
    expect(sim.prevPlayer).toEqual({ x: grid.playerStart.x, y: grid.playerStart.y });
    expect(sim.state.player.x).toBeGreaterThan(sim.prevPlayer.x);
  });

  it('marks state dirty only when something changed', () => {
    const sim = new Simulation(createNewGame(grid), grid);
    sim.advance(200);
    expect(sim.dirty).toBe(false);
    sim.setMoveInput(0, 1);
    sim.advance(50);
    expect(sim.dirty).toBe(true);
  });
});
