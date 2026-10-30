import { describe, expect, it } from 'vitest';
import { STATIONS, YARD } from '../src/data/layout';
import { boxHitsSolid, isSolid, parseGrid, Tile, tileAt } from '../src/sim/grid';

describe('parseGrid', () => {
  it('parses the M1 yard with its stations', () => {
    const grid = parseGrid(YARD, STATIONS);
    expect(grid.width).toBe(34);
    expect(grid.height).toBe(26);
    expect(grid.playerStart).toEqual({ x: 9.5, y: 16.5 });
    expect(tileAt(grid, 2, 3)).toBe(Tile.Fence);
    expect(tileAt(grid, 0, 11)).toBe(Tile.Road);
    expect(tileAt(grid, 0, 25)).toBe(Tile.Water);
    // Station footprints are solid.
    expect(isSolid(grid, 10, 9)).toBe(true);
    expect(isSolid(grid, 12, 9)).toBe(false);
  });

  it('rejects ragged rows, unknown characters, a missing start and off-map stations', () => {
    expect(() => parseGrid(['~P~', '~~'])).toThrow(/row 1/);
    expect(() => parseGrid(['~P?'])).toThrow(/Unknown layout character/);
    expect(() => parseGrid(['~.~'])).toThrow(/player start/);
    expect(() =>
      parseGrid(['.P.'], [{ id: 'b', kind: 'bin', item: 'iron', capacity: 1, rect: { x: 2, y: 0, w: 2, h: 1 }, zones: { deposit: { x: 0, y: 0, w: 1, h: 1 }, sell: { x: 1, y: 0, w: 1, h: 1 } } }]),
    ).toThrow(/off the map/);
  });
});

describe('collision shapes', () => {
  it('treats water and the outside of the grid as fully solid', () => {
    const grid = parseGrid(['~~~', '~P~', '~~~']);
    expect(isSolid(grid, 1, 1)).toBe(false);
    expect(isSolid(grid, 0, 1)).toBe(true);
    expect(isSolid(grid, -1, 1)).toBe(true);
    expect(boxHitsSolid(grid, 1, 1, 2, 2)).toBe(false);
    expect(boxHitsSolid(grid, 0.99, 1, 2, 2)).toBe(true);
  });

  it('makes fences thin lines through the middle of their tiles', () => {
    const grid = parseGrid(['.#.', '.#P', '...']);
    expect(isSolid(grid, 1, 0)).toBe(false);
    // The left and right thirds of a fence tile are open; the centre line is not.
    expect(boxHitsSolid(grid, 1.0, 0.2, 1.3, 0.4)).toBe(false);
    expect(boxHitsSolid(grid, 1.4, 0.2, 1.6, 0.4)).toBe(true);
    // The fence runs down to (1,1) but not on to (1,2).
    expect(boxHitsSolid(grid, 1.4, 1.7, 1.6, 1.9)).toBe(false);
  });
});
