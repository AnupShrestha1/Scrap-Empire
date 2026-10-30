import { describe, expect, it } from 'vitest';
import { parseGrid } from '../src/sim/grid';
import { createNewGame, isGameState, sanitizeState } from '../src/sim/state';

const grid = parseGrid(['~~~~~', '~P..~', '~~~~~']);

describe('isGameState', () => {
  it('accepts a new game', () => {
    expect(isGameState(createNewGame(grid, []))).toBe(true);
  });

  it.each([
    ['null', null],
    ['missing player', { tick: 0 }],
    ['negative tick', { tick: -1, player: { x: 1, y: 1, facing: 'up' } }],
    ['fractional tick', { tick: 1.5, player: { x: 1, y: 1, facing: 'up' } }],
    ['NaN position', { tick: 0, player: { x: NaN, y: 1, facing: 'up' } }],
    ['string position', { tick: 0, player: { x: '1', y: 1, facing: 'up' } }],
    ['bad facing', { tick: 0, player: { x: 1, y: 1, facing: 'north' } }],
    ['unknown carried item', { ...createNewGame(grid, []), player: { x: 1, y: 1, facing: 'up', stack: ['gold'] } }],
    ['bad truck phase', { ...createNewGame(grid, []), truck: { phase: 'flying', timer: 0, load: 0 } }],
  ])('rejects %s', (_label, value) => {
    expect(isGameState(value)).toBe(false);
  });
});

describe('sanitizeState', () => {
  it('moves a player stuck in a wall back to the start', () => {
    const state = createNewGame(grid, []);
    state.player.x = 0.5;
    expect(sanitizeState(state, grid, []).player).toMatchObject(grid.playerStart);
  });

  it('leaves a valid position alone', () => {
    const state = createNewGame(grid, []);
    state.player.x = 2.5;
    expect(sanitizeState(state, grid, []).player.x).toBe(2.5);
  });
});
