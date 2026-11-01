import { SIM, TICK_MS } from '../config';
import type { ProcessorStatus, SimEvent } from './events';
import { nearestFree, withStations, type Grid } from './grid';
import type { GameState } from './state';
import type { ProductId } from '../data/items';
import type { BayDef, BinDef, DealerDef, DumpDef, FactoryDef, LineDef, OutletDef, ProcessorDef, Rect, StationDef } from './stations';
import { stepBay } from './systems/bays';
import { stepStaff, type Brain, type StaffWorld } from './systems/staff';
import { dropStack, nextRandom, stepField } from './systems/field';
import { autoAssignLines, setLineProduct, stepLine } from './systems/manufacturing';
import { newInteractionState, padCharge, stepInteraction, type InteractionState } from './systems/interaction';
import { stepPlayer } from './systems/player';
import { processorCycleTicks, shredderFinds, stationOpen, trayCapacity } from './effective';
import { PLAYER } from '../data/player';
import { businessLevel, PRICES } from '../data/balance';
import { levelChest } from '../data/unlocks';
import { stepObjectives } from './systems/objectives';
import { processorStatus, stepProcessor } from './systems/processing';
import { stepSupplier } from './systems/supplier';
import type { Vec2 } from './vec';
import { truckRects } from './vehicles';

/**
 * Runs the game rules at a fixed tick rate, independent of the display's refresh rate.
 * Pure TypeScript with no Phaser imports, so it can be unit-tested and fast-forwarded.
 */
export class Simulation {
  readonly state: GameState;
  /** The ground with the open stations' footprints solid; rebuilt as stations open. */
  grid: Grid;
  /** The grid with every station, as given; open stations are picked from it. */
  private readonly fullGrid: Grid;
  private openKey = '';
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
  /** The shared random stream (saved with the field), for rare metal finds. */
  private readonly roll = (): number => nextRandom(this.state.field);
  private accumulator = 0;
  /** Set by requestDrop; applied at the start of the next tick. */
  private dropRequested = false;
  private readonly events: SimEvent[] = [];
  private readonly interaction: InteractionState = newInteractionState();
  private readonly statuses = new Map<string, ProcessorStatus>();
  private readonly dump: DumpDef;
  private readonly processorDefs: readonly ProcessorDef[];
  private readonly factories: readonly FactoryDef[];
  private readonly bayDefs: readonly BayDef[];
  private readonly staffWorld: StaffWorld;
  /** Ground covered by trucks this tick, solid to the player. */
  private readonly trucks: Rect[] = [];
  private readonly bayStates: { def: BayDef; bay: GameState['bays'][string] }[];
  /** Employees' current plans, by employee id; not saved. */
  readonly brains = new Map<number, Brain>();
  /** Bin definitions by id, for machines that pull from them. */
  readonly binDefs: ReadonlyMap<string, BinDef>;

  constructor(state: GameState, grid: Grid, stations: readonly StationDef[], dumpId: string) {
    this.state = state;
    this.grid = grid;
    this.fullGrid = grid;
    this.stations = stations;
    this.prevPlayer = { x: state.player.x, y: state.player.y };
    const dump = stations.find((s): s is DumpDef => s.kind === 'dump' && s.id === dumpId);
    if (!dump) throw new Error(`Truck route needs dump site '${dumpId}'`);
    this.dump = dump;
    this.processorDefs = stations.filter((s): s is ProcessorDef => s.kind === 'processor');
    this.factories = stations.filter((s): s is FactoryDef => s.kind === 'factory');
    this.bayDefs = stations.filter((s): s is BayDef => s.kind === 'bay');
    this.bayStates = this.bayDefs.map((def) => ({ def, bay: state.bays[def.id]! }));
    this.binDefs = new Map(stations.filter((s): s is BinDef => s.kind === 'bin').map((b) => [b.id, b]));
    this.staffWorld = {
      grid,
      dump,
      shredders: this.processorDefs,
      bins: [...this.binDefs.values()],
      factories: this.factories,
      bays: this.bayDefs,
      dealer: stations.find((s): s is DealerDef => s.kind === 'dealer'),
      outlet: stations.find((s): s is OutletDef => s.kind === 'outlet'),
    };
    for (const def of this.processorDefs) {
      this.statuses.set(def.id, processorStatus(def, state.processors[def.id]!, processorCycleTicks(def, state)));
    }
    this.refreshGrid();
  }

  /** Sets the movement input (grid direction, length 0..1) that the following ticks use. */
  setMoveInput(x: number, y: number): void {
    this.move.x = x;
    this.move.y = y;
  }

  /** Progress (0..1) of the stand-still on a sell, upgrade or build pad, for the countdown ring. */
  get padCharge(): number | undefined {
    return padCharge(this.interaction);
  }

  /** The Drop button: drop everything carried on the next tick. */
  requestDrop(): void {
    this.dropRequested = true;
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

  /** Announces each business level passed between `from` and `to`, paying its chest. */
  private levelUp(from: number, to: number): void {
    for (let level = from + 1; level <= to; level++) {
      const chest = levelChest(level);
      this.state.money += chest;
      this.events.push({ type: 'levelUp', level, chest });
    }
  }

  /** The zone the player is standing in ("stationId:zone"), if any. */
  get zone(): string | null {
    return this.interaction.zoneKey;
  }

  /** Sets what a factory line makes (from the recipe card); this turns the line's Auto off. */
  setLineProduct(lineId: string, product: ProductId): boolean {
    const st = this.state.lines[lineId];
    if (!st) return false;
    for (const factory of this.factories) {
      if (factory.lines.some((l) => l.id === lineId) && (st.product === product || setLineProduct(factory, lineId, product, this.binDefs, this.state))) {
        st.auto = false;
        this.dirty = true;
        return true;
      }
    }
    return false;
  }

  /** Turns a line's Auto (follow the trucks) on or off. */
  setLineAuto(lineId: string, auto: boolean): void {
    const st = this.state.lines[lineId];
    if (!st || st.auto === auto) return;
    st.auto = auto;
    this.dirty = true;
  }

  /**
   * Sells up to `count` items from a bin at the Scrap Dealer's price (the storage card's buttons). Only
   * while the player stands on a dealer's storage pad. Returns how many were sold.
   */
  sellStock(binId: string, count: number): number {
    const zone = this.interaction.zoneKey;
    const dealer = this.stations.find((s) => s.kind === 'dealer' && zone === `${s.id}:stock`);
    const bin = this.binDefs.get(binId);
    const stored = this.state.bins[binId];
    if (!dealer || !bin || !stored) return 0;
    const n = Math.min(count, stored.count);
    const value = PRICES[bin.item];
    const levelBefore = businessLevel(this.state.earned);
    for (let i = 0; i < n; i++) {
      stored.count--;
      this.state.money += value;
      this.state.earned += value;
      this.events.push({ type: 'sold', station: dealer.id, item: bin.item, value });
    }
    if (n > 0) this.dirty = true;
    this.levelUp(levelBefore, businessLevel(this.state.earned));
    return n;
  }

  /** A factory production line by id. */
  factoryLine(id: string): LineDef | undefined {
    for (const factory of this.factories) {
      const line = factory.lines.find((l) => l.id === id);
      if (line) return line;
    }
    return undefined;
  }

  /** Hands over everything that happened since the last call. */
  drainEvents(out: SimEvent[]): SimEvent[] {
    out.length = 0;
    out.push(...this.events);
    this.events.length = 0;
    return out;
  }

  /**
   * Rebuilds the grid when the set of open stations changes, so locked stations are neither drawn nor
   * solid, and moves anyone a newly opened station would trap to the nearest free spot.
   */
  private refreshGrid(): void {
    const open = this.stations.filter((s) => stationOpen(s, this.state));
    const key = open.map((s) => s.id).join(',');
    if (key === this.openKey) return;
    this.openKey = key;
    this.grid = withStations(this.fullGrid, open);
    this.staffWorld.grid = this.grid;
    const p = this.state.player;
    const free = nearestFree(this.grid, p, PLAYER.halfSize);
    p.x = free.x;
    p.y = free.y;
    for (const e of this.state.employees) {
      const spot = nearestFree(this.grid, e, PLAYER.halfSize);
      e.x = spot.x;
      e.y = spot.y;
      this.brains.delete(e.id);
    }
  }

  private step(): void {
    const { state, events } = this;
    this.refreshGrid();
    const firstEvent = events.length;
    const levelBefore = businessLevel(state.earned);
    const p = state.player;
    this.prevPlayer.x = p.x;
    this.prevPlayer.y = p.y;
    truckRects(state.truck, this.bayStates, this.trucks);
    let changed = stepPlayer(p, this.move, this.grid, TICK_MS / 1000, this.trucks);
    if (this.dropRequested) {
      this.dropRequested = false;
      changed = dropStack(state, this.grid, events) || changed;
    }
    changed = stepField(state, this.dump, TICK_MS / 1000, events) || changed;
    const moved = p.x !== this.prevPlayer.x || p.y !== this.prevPlayer.y;
    changed = stepInteraction(state, this.stations, this.interaction, events, moved) || changed;
    changed = stepSupplier(state, this.dump, events) || changed;
    for (const def of this.processorDefs) {
      const machine = state.processors[def.id]!;
      if (!machine.built) continue;
      const cycle = processorCycleTicks(def, state, machine);
      changed = stepProcessor(def, machine, cycle, events, shredderFinds(state), this.roll, trayCapacity(def, state)) || changed;
      const status = processorStatus(def, machine, cycle);
      if (status !== this.statuses.get(def.id)) {
        this.statuses.set(def.id, status);
        events.push({ type: 'processorStatus', station: def.id, status });
      }
    }
    for (const factory of this.factories) {
      changed = autoAssignLines(factory, this.binDefs, state) || changed;
      for (const line of factory.lines) {
        changed = stepLine(factory, line, state.lines[line.id]!, this.binDefs, state, events) || changed;
      }
    }
    changed = stepStaff(state, this.staffWorld, this.brains, events) || changed;
    for (const bay of this.bayDefs) {
      changed = stepBay(bay, state.bays[bay.id]!, state, this.factories, events) || changed;
    }
    const levelAfter = businessLevel(state.earned);
    this.levelUp(levelBefore, levelAfter);
    // Objectives look at this tick's events only (earlier ones may not have been drained yet).
    changed = stepObjectives(state, events.slice(firstEvent), events) || changed;
    this.levelUp(levelAfter, businessLevel(state.earned));
    if (changed) this.dirty = true;
    state.tick++;
  }
}
