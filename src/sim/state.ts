import { PILE, SUPPLIER } from '../data/balance';
import { emptyItemCounts, isItemId, ITEM_IDS, type ItemId } from '../data/items';
import { PLAYER } from '../data/player';
import { SIM } from '../config';
import { emptyUpgradeCounts, UPGRADE_IDS, type UpgradeId } from '../data/upgrades';
import { boxHitsSolid, type Grid } from './grid';
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

export interface PileState {
  items: number;
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
}

export interface BinState {
  count: number;
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
  piles: Record<string, PileState>;
  processors: Record<string, ProcessorState>;
  bins: Record<string, BinState>;
}

export function secondsToTicks(seconds: number): number {
  return Math.max(1, Math.round(seconds * SIM.tickRate));
}

export function newProcessorState(): ProcessorState {
  return { hopper: 0, progress: 0, tray: emptyItemCounts(), carry: emptyItemCounts() };
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
    piles: {},
    processors: {},
    bins: {},
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
    isMapOf(value.piles, (p) => isCount(p.items)) &&
    isMapOf(value.bins, (b) => isCount(b.count)) &&
    isMapOf(
      value.processors,
      (m) => isCount(m.hopper) && isCount(m.progress) && isItemCounts(m.tray) && isItemCounts(m.carry, true),
    )
  );
}

/**
 * Makes a loaded state fit the current layout: adds state for new stations, drops state for removed
 * ones, clamps counts to capacities and moves a player who would be inside something back to the start.
 */
export function sanitizeState(state: GameState, grid: Grid, stations: readonly StationDef[]): GameState {
  const piles: Record<string, PileState> = {};
  const processors: Record<string, ProcessorState> = {};
  const bins: Record<string, BinState> = {};
  for (const s of stations) {
    switch (s.kind) {
      case 'pile': {
        const items = state.piles[s.id]?.items ?? PILE.startItems;
        piles[s.id] = { items: Math.min(items, s.capacity) };
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
        break;
    }
  }
  state.piles = piles;
  state.processors = processors;
  state.bins = bins;

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
