import { PLAYER } from '../data/player';
import { boxHitsSolid, type Grid } from './grid';

export type Facing = 'up' | 'down' | 'left' | 'right';
const FACINGS: readonly string[] = ['up', 'down', 'left', 'right'] satisfies Facing[];

export interface PlayerState {
  /** Centre position in tiles. */
  x: number;
  y: number;
  facing: Facing;
}

/** Everything that gets saved. Plain data only, so it serialises to JSON as-is. */
export interface GameState {
  /** Simulation ticks played so far. */
  tick: number;
  player: PlayerState;
}

export function createNewGame(grid: Grid): GameState {
  return {
    tick: 0,
    player: { x: grid.playerStart.x, y: grid.playerStart.y, facing: 'down' },
  };
}

export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !isRecord(value.player)) return false;
  const { tick, player } = value;
  return (
    Number.isInteger(tick) &&
    (tick as number) >= 0 &&
    Number.isFinite(player.x) &&
    Number.isFinite(player.y) &&
    FACINGS.includes(player.facing as string)
  );
}

/** Repairs a loaded state that no longer fits the current layout, e.g. a player saved inside a new wall. */
export function sanitizeState(state: GameState, grid: Grid): GameState {
  const p = state.player;
  const r = PLAYER.halfSize;
  if (boxHitsSolid(grid, p.x - r, p.y - r, p.x + r, p.y + r)) {
    p.x = grid.playerStart.x;
    p.y = grid.playerStart.y;
  }
  return state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
