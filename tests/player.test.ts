import { describe, expect, it } from 'vitest';
import { PLAYER } from '../src/data/player';
import { parseGrid } from '../src/sim/grid';
import { createNewGame } from '../src/sim/state';
import { stepPlayer } from '../src/sim/systems/player';

const DT = 0.05;
const grid = parseGrid([
  '########',
  '#P.....#',
  '#......#',
  '#......#',
  '########',
]);

function walk(move: { x: number; y: number }, ticks: number) {
  const { player } = createNewGame(grid);
  for (let i = 0; i < ticks; i++) stepPlayer(player, move, grid, DT);
  return player;
}

describe('stepPlayer', () => {
  it('moves at PLAYER.speed tiles per second', () => {
    const p = walk({ x: 1, y: 0 }, 4);
    expect(p.x).toBeCloseTo(1.5 + PLAYER.speed * DT * 4);
  });

  it('normalises diagonal movement', () => {
    const p = walk({ x: 1, y: 1 }, 1);
    expect(Math.hypot(p.x - 1.5, p.y - 1.5)).toBeCloseTo(PLAYER.speed * DT);
  });

  it('stops flush against a wall', () => {
    const p = walk({ x: 1, y: 0 }, 100);
    const wallEdge = 7;
    expect(p.x + PLAYER.halfSize).toBeLessThan(wallEdge);
    expect(p.x + PLAYER.halfSize).toBeGreaterThan(wallEdge - 0.01);
  });

  it('stops flush when walking left and up into walls', () => {
    const p = walk({ x: -1, y: -1 }, 100);
    expect(p.x - PLAYER.halfSize).toBeGreaterThan(1);
    expect(p.x - PLAYER.halfSize).toBeLessThan(1.01);
    expect(p.y - PLAYER.halfSize).toBeGreaterThan(1);
  });

  it('slides along a wall when pushing diagonally into it', () => {
    const { player } = createNewGame(grid);
    for (let i = 0; i < 100; i++) stepPlayer(player, { x: 1, y: 0 }, grid, DT);
    const xAtWall = player.x;
    stepPlayer(player, { x: 1, y: 1 }, grid, DT);
    expect(player.x).toBeCloseTo(xAtWall);
    expect(player.y).toBeGreaterThan(1.5);
  });

  it('faces the dominant direction and reports whether it moved', () => {
    const { player } = createNewGame(grid);
    expect(stepPlayer(player, { x: 0, y: 0 }, grid, DT)).toBe(false);
    expect(stepPlayer(player, { x: 0.2, y: 0.9 }, grid, DT)).toBe(true);
    expect(player.facing).toBe('down');
    stepPlayer(player, { x: -1, y: 0.1 }, grid, DT);
    expect(player.facing).toBe('left');
  });
});
