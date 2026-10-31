import type { ManufacturerRecipe, ProcessorRecipe } from '../data/balance';
import type { ItemId } from '../data/items';
import type { UpgradeId } from '../data/upgrades';

/** A rectangle of tiles: covers [x, x + w) × [y, y + h). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface StationBase {
  id: string;
  rect: Rect;
}

export interface PileDef extends StationBase {
  kind: 'pile';
  /** Limits truck deliveries only; scrap returned by the player may go over it. */
  capacity: number;
  /** `take` picks scrap up; `return` puts carried scrap back, so the player can always free their hands. */
  zones: { take: Rect; return: Rect };
}

export interface ProcessorDef extends StationBase {
  kind: 'processor';
  recipe: ProcessorRecipe;
  /** The upgrade that speeds this machine up. */
  speedUpgrade?: UpgradeId;
  zones: { input: Rect; output: Rect };
}

export interface BinDef extends StationBase {
  kind: 'bin';
  item: ItemId;
  capacity: number;
  /** `deposit` takes matching items from the player; `sell` sells the bin's contents, so it can always be emptied. */
  zones: { deposit: Rect; sell: Rect };
}

/** One production line inside the factory. Lines are bought in order on the factory's build pad. */
export interface LineDef {
  id: string;
  /** i18n key for its name. */
  name: 'machine.press' | 'machine.canLine';
  recipe: ManufacturerRecipe;
  /** Bins it pulls inputs from, through a chute (storage is the hub; nobody carries inputs to it). */
  feeds: readonly string[];
  buildCost: number;
}

/**
 * The factory: one building holding production lines. Each built line pulls from its feed bins and
 * sells what it makes straight away.
 */
export interface FactoryDef extends StationBase {
  kind: 'factory';
  lines: readonly LineDef[];
  /** Raised chutes from bins to the factory, for drawing: tiles along +x from (x, y); shown once `line` is built. */
  chutes: readonly { x: number; y: number; length: number; line: string }[];
  zones: { build: Rect };
}

/** A walkable pad where the player pays in cash for an upgrade. Not solid. */
export interface CashPadDef extends StationBase {
  kind: 'cashPad';
  upgrade: UpgradeId;
  zones: { buy: Rect };
}

export type StationDef = PileDef | ProcessorDef | BinDef | CashPadDef | FactoryDef;

export type ZoneHit =
  | { station: PileDef; zone: 'take' | 'return' }
  | { station: ProcessorDef; zone: 'input' | 'output' }
  | { station: BinDef; zone: 'deposit' | 'sell' }
  | { station: CashPadDef; zone: 'buy' }
  | { station: FactoryDef; zone: 'build' };

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** The interaction zone containing point (x, y), if any. Zones are laid out not to overlap. */
export function zoneAt(stations: readonly StationDef[], x: number, y: number): ZoneHit | null {
  for (const s of stations) {
    switch (s.kind) {
      case 'pile':
        if (inRect(s.zones.take, x, y)) return { station: s, zone: 'take' };
        if (inRect(s.zones.return, x, y)) return { station: s, zone: 'return' };
        break;
      case 'processor':
        if (inRect(s.zones.input, x, y)) return { station: s, zone: 'input' };
        if (inRect(s.zones.output, x, y)) return { station: s, zone: 'output' };
        break;
      case 'bin':
        if (inRect(s.zones.deposit, x, y)) return { station: s, zone: 'deposit' };
        if (inRect(s.zones.sell, x, y)) return { station: s, zone: 'sell' };
        break;
      case 'cashPad':
        if (inRect(s.zones.buy, x, y)) return { station: s, zone: 'buy' };
        break;
      case 'factory':
        if (inRect(s.zones.build, x, y)) return { station: s, zone: 'build' };
        break;
    }
  }
  return null;
}
