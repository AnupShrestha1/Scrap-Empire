import { FIELD, SUPPLIER } from '../data/balance';
import { PIECE_KINDS } from '../data/scrap';
import { emptyItemCounts, isItemId, isProduct, ITEM_IDS, type ItemId, type ProductId } from '../data/items';
import { PLAYER } from '../data/player';
import { SIM } from '../config';
import { emptyUpgradeCounts, UPGRADE_IDS, type UpgradeId } from '../data/upgrades';
import { boxHitsSolid, type Grid } from './grid';
import { randomKind, scatterPiece } from './systems/field';
import type { StationDef } from './stations';

export type Facing = 'up' | 'down' | 'left' | 'right';
const FACINGS: readonly string[] = ['up', 'down', 'left', 'right'] satisfies Facing[];

export interface PlayerState {
  /** Centre position in tiles. */
  x: number;
  y: number;
  facing: Facing;
  /** Carried items, bottom first. May be mixed. */
  stack: ItemId[];
}

/** A piece of scrap lying on the dump site. */
export interface FieldPiece {
  id: number;
  /** Position in tiles. */
  x: number;
  y: number;
  /** Index into PIECE_KINDS. */
  kind: number;
  /**
   * Set on things the player dropped: they can't be picked up until the player has walked out of magnet
   * range, so standing still after dropping doesn't pull everything straight back.
   */
  locked?: boolean;
}

export interface FieldState {
  pieces: FieldPiece[];
  /** Seed of the field's own random generator, so scatter is reproducible and survives saves. */
  seed: number;
  nextId: number;
  /** Scrap units still to scatter (from an old save's pile); sanitizeState scatters them. */
  pendingUnits?: number;
}

export interface ProcessorState {
  /** Inputs waiting to be processed. */
  hopper: number;
  /** Ticks into the current cycle; 0 when not working. */
  progress: number;
  /** Finished items waiting to be collected. */
  tray: Record<ItemId, number>;
  /** Fractional output carried over between cycles, so yields are exact over time. */
  carry: Record<ItemId, number>;
  /** Inputs processed so far; the first few go faster (a warm start). */
  shredded: number;
}

export interface BinState {
  count: number;
}

export interface LineState {
  built: boolean;
  /** What the line makes (chosen on the factory's recipe pad). */
  product: ProductId;
  /** Ticks into the current batch; 0 when not working. */
  progress: number;
  /** Finished products waiting on the line's output spot... */
  out: number;
  /** ...and what they are (they may be from an earlier recipe). */
  outItem: ProductId | null;
}

export type BayPhase = 'empty' | 'arriving' | 'waiting' | 'leaving';
const BAY_PHASES: readonly string[] = ['empty', 'arriving', 'waiting', 'leaving'] satisfies BayPhase[];

/** A buyer truck's order in one loading bay lane. */
export interface BayState {
  phase: BayPhase;
  /** Ticks left in the phase (patience while waiting). */
  timer: number;
  item: ItemId | null;
  want: number;
  have: number;
}

export type TruckPhase = 'away' | 'arriving' | 'unloading' | 'waiting' | 'leaving';
const TRUCK_PHASES: readonly string[] = ['away', 'arriving', 'unloading', 'waiting', 'leaving'] satisfies TruckPhase[];

export interface TruckState {
  phase: TruckPhase;
  /** Ticks left in the current phase (or until the next unload while unloading). */
  timer: number;
  /** Items still on the truck. */
  load: number;
}

/** A hired helper (see systems/staff.ts). Only position and load are saved; plans are rebuilt. */
export interface Employee {
  id: number;
  x: number;
  y: number;
  facing: Facing;
  stack: ItemId[];
}

/** Everything that gets saved. Plain data only, so it serialises to JSON as-is. */
export interface GameState {
  /** Simulation ticks played so far. */
  tick: number;
  /** Whole dollars. */
  money: number;
  /** All cash ever earned (sales and rewards); will drive business level. */
  earned: number;
  /** Bought level of each upgrade. */
  upgrades: Record<UpgradeId, number>;
  /** Cash already paid towards each upgrade's next level. */
  upgradePaid: Record<UpgradeId, number>;
  /** Position in the objective chain, and progress on the current objective. */
  objectives: { index: number; progress: number };
  player: PlayerState;
  truck: TruckState;
  field: FieldState;
  processors: Record<string, ProcessorState>;
  bins: Record<string, BinState>;
  /** Factory production lines, by line id. */
  lines: Record<string, LineState>;
  /** Cash already paid towards building each unbuilt line. */
  buildPaid: Record<string, number>;
  bays: Record<string, BayState>;
  employees: Employee[];
  /** Cash already paid towards the next hire. */
  hirePaid: number;
  /** Set once the first buyer truck has been sent (it comes the moment the first product is made). */
  firstOrder: boolean;
}

export function secondsToTicks(seconds: number): number {
  return Math.max(1, Math.round(seconds * SIM.tickRate));
}

export function newProcessorState(): ProcessorState {
  return { hopper: 0, progress: 0, tray: emptyItemCounts(), carry: emptyItemCounts(), shredded: 0 };
}

export function createNewGame(grid: Grid, stations: readonly StationDef[]): GameState {
  const state: GameState = {
    tick: 0,
    money: 0,
    earned: 0,
    upgrades: emptyUpgradeCounts(),
    upgradePaid: emptyUpgradeCounts(),
    objectives: { index: 0, progress: 0 },
    player: { x: grid.playerStart.x, y: grid.playerStart.y, facing: 'down', stack: [] },
    truck: { phase: 'away', timer: secondsToTicks(SUPPLIER.firstDeliveryS), load: 0 },
    field: { pieces: [], seed: 20261031, nextId: 0, pendingUnits: FIELD.startUnits },
    processors: {},
    bins: {},
    lines: {},
    buildPaid: {},
    bays: {},
    employees: [],
    hirePaid: 0,
    firstOrder: false,
  };
  return sanitizeState(state, grid, stations);
}

export function isGameState(value: unknown): value is GameState {
  if (!isRecord(value) || !isRecord(value.player) || !isRecord(value.truck)) return false;
  const { tick, player, truck } = value;
  return (
    isCount(tick) &&
    isCount(value.money) &&
    isCount(value.earned) &&
    isUpgradeCounts(value.upgrades) &&
    isUpgradeCounts(value.upgradePaid) &&
    isRecord(value.objectives) &&
    isCount(value.objectives.index) &&
    isCount(value.objectives.progress) &&
    Number.isFinite(player.x) &&
    Number.isFinite(player.y) &&
    FACINGS.includes(player.facing as string) &&
    Array.isArray(player.stack) &&
    player.stack.every(isItemId) &&
    TRUCK_PHASES.includes(truck.phase as string) &&
    isCount(truck.timer) &&
    isCount(truck.load) &&
    isField(value.field) &&
    isCount(value.hirePaid) &&
    typeof value.firstOrder === 'boolean' &&
    Array.isArray(value.employees) &&
    value.employees.every(
      (e: unknown) =>
        isRecord(e) &&
        isCount(e.id) &&
        Number.isFinite(e.x) &&
        Number.isFinite(e.y) &&
        FACINGS.includes(e.facing as string) &&
        Array.isArray(e.stack) &&
        e.stack.every(isItemId),
    ) &&
    isMapOf(value.bins, (b) => isCount(b.count)) &&
    isMapOf(
      value.lines,
      (l) =>
        typeof l.built === 'boolean' &&
        isProductId(l.product) &&
        isCount(l.progress) &&
        isCount(l.out) &&
        (l.outItem === null || isProductId(l.outItem)),
    ) &&
    isMapOf(
      value.bays,
      (b) =>
        BAY_PHASES.includes(b.phase as string) &&
        isCount(b.timer) &&
        (b.item === null || isItemId(b.item)) &&
        isCount(b.want) &&
        isCount(b.have),
    ) &&
    isRecord(value.buildPaid) &&
    Object.values(value.buildPaid).every(isCount) &&
    isMapOf(
      value.processors,
      (m) => isCount(m.hopper) && isCount(m.progress) && isCount(m.shredded) && isItemCounts(m.tray) && isItemCounts(m.carry, true),
    )
  );
}

/**
 * Makes a loaded state fit the current layout: adds state for new stations, drops state for removed
 * ones, clamps counts to capacities and moves a player who would be inside something back to the start.
 */
export function sanitizeState(state: GameState, grid: Grid, stations: readonly StationDef[]): GameState {
  const processors: Record<string, ProcessorState> = {};
  const bins: Record<string, BinState> = {};
  const lines: Record<string, LineState> = {};
  const bays: Record<string, BayState> = {};
  const buildPaid: Record<string, number> = {};
  for (const s of stations) {
    switch (s.kind) {
      case 'dump': {
        // Scatter anything owed (a new game's starting scrap, or an old save's pile).
        const field = state.field;
        let units = field.pendingUnits ?? 0;
        while (units > 0) {
          const kind = randomKind(field, units);
          scatterPiece(field, s.zones.field, kind);
          units -= PIECE_KINDS[kind]!.units;
        }
        delete field.pendingUnits;
        break;
      }
      case 'processor':
        processors[s.id] = state.processors[s.id] ?? newProcessorState();
        break;
      case 'bin':
        // Upgrades can raise capacity, so only drop negative or broken counts here.
        bins[s.id] = { count: state.bins[s.id]?.count ?? 0 };
        break;
      case 'cashPad':
      case 'outlet':
      case 'staffHut':
      case 'dealer':
        break;
      case 'bay':
        bays[s.id] = state.bays[s.id] ?? { phase: 'empty', timer: 1, item: null, want: 0, have: 0 };
        break;
      case 'factory':
        for (const line of s.lines) {
          lines[line.id] = state.lines[line.id] ?? { built: false, product: 'sheet', progress: 0, out: 0, outItem: null };
          buildPaid[line.id] = state.buildPaid[line.id] ?? 0;
        }
        break;
    }
  }
  state.processors = processors;
  state.bins = bins;
  state.lines = lines;
  state.bays = bays;
  state.buildPaid = buildPaid;

  const p = state.player;
  const r = PLAYER.halfSize;
  if (boxHitsSolid(grid, p.x - r, p.y - r, p.x + r, p.y + r)) {
    p.x = grid.playerStart.x;
    p.y = grid.playerStart.y;
  }
  return state;
}

function isField(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.pieces) || !isCount(value.nextId) || !isCount(value.seed)) return false;
  return value.pieces.every(
    (p: unknown) =>
      isRecord(p) &&
      isCount(p.id) &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.y) &&
      isCount(p.kind) &&
      (p.kind as number) < PIECE_KINDS.length &&
      (p.locked === undefined || typeof p.locked === 'boolean'),
  );
}

function isProductId(value: unknown): boolean {
  return isItemId(value) && isProduct(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCount(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isMapOf(value: unknown, check: (entry: Record<string, unknown>) => boolean): boolean {
  return isRecord(value) && Object.values(value).every((v) => isRecord(v) && check(v));
}

function isUpgradeCounts(value: unknown): boolean {
  return isRecord(value) && UPGRADE_IDS.every((id) => isCount(value[id]));
}

function isItemCounts(value: unknown, fractional = false): boolean {
  if (!isRecord(value)) return false;
  return ITEM_IDS.every((id) => {
    const n = value[id];
    return fractional ? typeof n === 'number' && Number.isFinite(n) && n >= 0 : isCount(n);
  });
}
