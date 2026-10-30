import { describe, expect, it } from 'vitest';
import { YARD } from '../src/data/layout';
import { boxHitsSolid, isSolid, parseGrid, Tile, tileAt } from '../src/sim/grid';

describe('parseGrid', () => {
  it('parses the M0 yard', () => {
    const grid = parseGrid(YARD);
    expect(grid.width).toBe(40);
    expect(grid.height).toBe(26);
    expect(grid.playerStart).toEqual({ x: 14.5, y: 12.5 });
    expect(tileAt(grid, 0, 0)).toBe(Tile.Fence);
    expect(tileAt(grid, 0, 12)).toBe(Tile.Road);
    expect(tileAt(grid, 14, 12)).toBe(Tile.Dirt);
  });

  it('rejects ragged rows, unknown characters and a missing start', () => {
    expect(() => parseGrid(['#P#', '##'])).toThrow(/row 1/);
    expect(() => parseGrid(['#P?'])).toThrow(/Unknown layout character/);
    expect(() => parseGrid(['#.#'])).toThrow(/player start/);
  });
});

describe('collision helpers', () => {
  const grid = parseGrid(['###', '#P#', '###']);

  it('treats fences and the outside of the grid as solid', () => {
    expect(isSolid(grid, 1, 1)).toBe(false);
    expect(isSolid(grid, 0, 1)).toBe(true);
    expect(isSolid(grid, -1, 1)).toBe(true);
    expect(isSolid(grid, 1, 3)).toBe(true);
  });

  it('does not count a box that only touches a solid tile edge', () => {
    expect(boxHitsSolid(grid, 1, 1, 2, 2)).toBe(false);
    expect(boxHitsSolid(grid, 0.99, 1, 2, 2)).toBe(true);
    expect(boxHitsSolid(grid, 1, 1, 2.01, 2)).toBe(true);
  });
});
