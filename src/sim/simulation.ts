import { SIM, TICK_MS } from '../config';
import type { ProcessorStatus, SimEvent } from './events';
import type { Grid } from './grid';
import type { GameState } from './state';
import type { PileDef, ProcessorDef, StationDef } from './stations';
import { newInteractionState, stepInteraction, type InteractionState } from './systems/interaction';
import { stepPlayer } from './systems/player';
import { processorCycleTicks } from './effective';
import { stepObjectives } from './systems/objectives';
import { processorStatus, stepProcessor } from './systems/processing';
import { stepSupplier } from './systems/supplier';
import type { Vec2 } from './vec';

/**
 * Runs the game rules at a fixed tick rate, independent of the display's refresh rate.
 * Pure TypeScript with no Phaser imports, so it can be unit-tested and fast-forwarded.
 */
export class Simulation {
  readonly state: GameState;
  readonly grid: Grid;
  readonly stations: readonly StationDef[];
  /** Player position at the start of the latest tick, for interpolating the sprite between ticks. */
  readonly prevPlayer: Vec2;
  /** Set when saved state changes in a way worth saving; the autosaver clears it. */
  dirty = false;
  /** Wall-clock time spent in the last advance() call, for the debug overlay. */
  lastAdvanceMs = 0;
  /** Debug fast-forward: game seconds per real second. */
  timeScale = 1;

  private readonly move: Vec2 = { x: 0, y: 0 };
  private accumulator = 0;
  private readonly events: SimEvent[] = [];
  private readonly interaction: InteractionState = newInteractionState();
  private readonly statuses = new Map<string, ProcessorStatus>();
  private readonly truckPile: PileDef;
  private readonly processorDefs: readonly ProcessorDef[];

  constructor(state: GameState, grid: Grid, stations: readonly StationDef[], truckPileId: string) {
    this.state = state;
    this.grid = grid;
    this.stations = stations;
    this.prevPlayer = { x: state.player.x, y: state.player.y };
    const pile = stations.find((s): s is PileDef => s.kind === 'pile' && s.id === truckPileId);
    if (!pile) throw new Error(`Truck route needs pile '${truckPileId}'`);
    this.truckPile = pile;
    this.processorDefs = stations.filter((s): s is ProcessorDef => s.kind === 'processor');
    for (const def of this.processorDefs) {
      this.statuses.set(def.id, processorStatus(def, state.processors[def.id]!, processorCycleTicks(def, state)));
    }
  }

  /** Sets the movement input (grid direction, length 0..1) that the following ticks use. */
  setMoveInput(x: number, y: number): void {
    this.move.x = x;
    this.move.y = y;
  }

  /** Runs as many whole ticks as `elapsedMs` of real time covers. Returns the number of ticks run. */
  advance(elapsedMs: number): number {
    const started = performance.now();
    this.accumulator += Math.min(Math.max(elapsedMs, 0), SIM.maxFrameMs) * this.timeScale;
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

  /** Hands over everything that happened since the last call. */
  drainEvents(out: SimEvent[]): SimEvent[] {
    out.length = 0;
    out.push(...this.events);
    this.events.length = 0;
    return out;
  }

  private step(): void {
    const { state, events } = this;
    const firstEvent = events.length;
    const p = state.player;
    this.prevPlayer.x = p.x;
    this.prevPlayer.y = p.y;
    let changed = stepPlayer(p, this.move, this.grid, TICK_MS / 1000);
    changed = stepInteraction(state, this.stations, this.interaction, events) || changed;
    changed = stepSupplier(state, this.truckPile, events) || changed;
    for (const def of this.processorDefs) {
      const machine = state.processors[def.id]!;
      const cycle = processorCycleTicks(def, state);
      changed = stepProcessor(def, machine, cycle, events) || changed;
      const status = processorStatus(def, machine, cycle);
      if (status !== this.statuses.get(def.id)) {
        this.statuses.set(def.id, status);
        events.push({ type: 'processorStatus', station: def.id, status });
      }
    }
    // Objectives look at this tick's events only (earlier ones may not have been drained yet).
    changed = stepObjectives(state, events.slice(firstEvent), events) || changed;
    if (changed) this.dirty = true;
    state.tick++;
  }
}
