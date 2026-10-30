import { SIM, TICK_MS } from '../config';
import type { Grid } from './grid';
import type { GameState } from './state';
import { stepPlayer } from './systems/player';
import type { Vec2 } from './vec';

/**
 * Runs the game rules at a fixed tick rate, independent of the display's refresh rate.
 * Pure TypeScript with no Phaser imports, so it can be unit-tested and fast-forwarded.
 */
export class Simulation {
  readonly state: GameState;
  readonly grid: Grid;
  /** Player position at the start of the latest tick, for interpolating the sprite between ticks. */
  readonly prevPlayer: Vec2;
  /** Set when saved state changes; the autosaver clears it. */
  dirty = false;
  /** Wall-clock time spent in the last advance() call, for the debug overlay. */
  lastAdvanceMs = 0;

  private readonly move: Vec2 = { x: 0, y: 0 };
  private accumulator = 0;

  constructor(state: GameState, grid: Grid) {
    this.state = state;
    this.grid = grid;
    this.prevPlayer = { x: state.player.x, y: state.player.y };
  }

  /** Sets the movement input (length 0..1) that the following ticks use. */
  setMoveInput(x: number, y: number): void {
    this.move.x = x;
    this.move.y = y;
  }

  /** Runs as many whole ticks as `elapsedMs` of real time covers. Returns the number of ticks run. */
  advance(elapsedMs: number): number {
    const started = performance.now();
    this.accumulator += Math.min(Math.max(elapsedMs, 0), SIM.maxFrameMs);
    let ticks = 0;
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      this.step();
      ticks++;
    }
    this.lastAdvanceMs = performance.now() - started;
    return ticks;
  }

  /** How far (0..1) real time has progressed into the next tick. */
  get alpha(): number {
    return this.accumulator / TICK_MS;
  }

  private step(): void {
    const p = this.state.player;
    this.prevPlayer.x = p.x;
    this.prevPlayer.y = p.y;
    if (stepPlayer(p, this.move, this.grid, TICK_MS / 1000)) this.dirty = true;
    this.state.tick++;
  }
}
