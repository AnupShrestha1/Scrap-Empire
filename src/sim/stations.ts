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

/**
 * The dump site: a walkable field where delivered scrap lies scattered. The player collects pieces by
 * walking near them (see systems/field.ts), and can drop carried scrap back on the `return` pad.
 */
export interface DumpDef extends StationBase {
  kind: 'dump';
  /** Most pieces on the field; limits truck deliveries only (returned scrap may go over it). */
  capacity: number;
  zones: { field: Rect; return: Rect };
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
  /** Bins it pulls inputs from directly (storage is the hub; nobody carries inputs to it). */
  feeds: readonly string[];
  buildCost: number;
  /** Business level needed before it can be bought. */
  requiresLevel?: number;
  /** The upgrade that speeds this line up. */
  speedUpgrade?: UpgradeId;
  /** Where its products come out, to be picked up. */
  output: Rect;
}

/**
 * The factory: one building holding production lines. Each built line pulls straight from its feed bins
 * and sells what it makes at once.
 */
export interface FactoryDef extends StationBase {
  kind: 'factory';
  lines: readonly LineDef[];
  zones: { build: Rect };
}

/** A loading bay lane: buyer trucks back in to `lane.parkX` on `lane.row`; load them from `zones.load`. */
export interface BayDef extends StationBase {
  kind: 'bay';
  lane: { row: number; parkX: number; startX: number };
  zones: { load: Rect };
}

/** Sells carried products outright, at the base price. */
export interface OutletDef extends StationBase {
  kind: 'outlet';
  zones: { sell: Rect };
}

/** The staff hut, where employees are hired on the pad in front. */
export interface StaffHutDef extends StationBase {
  kind: 'staffHut';
  zones: { hire: Rect };
}

/** A walkable pad where the player pays in cash for an upgrade. Not solid. */
export interface CashPadDef extends StationBase {
  kind: 'cashPad';
  upgrade: UpgradeId;
  zones: { buy: Rect };
}

export type StationDef = DumpDef | ProcessorDef | BinDef | CashPadDef | FactoryDef | BayDef | OutletDef | StaffHutDef;

export type ZoneHit =
  | { station: DumpDef; zone: 'return' }
  | { station: ProcessorDef; zone: 'input' | 'output' }
  | { station: BinDef; zone: 'deposit' | 'sell' }
  | { station: CashPadDef; zone: 'buy' }
  | { station: FactoryDef; zone: 'build' }
  | { station: FactoryDef; zone: 'lineOutput'; line: LineDef }
  | { station: BayDef; zone: 'load' }
  | { station: OutletDef; zone: 'sell' }
  | { station: StaffHutDef; zone: 'hire' };

export function inRect(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
}

/** The interaction zone containing point (x, y), if any. Zones are laid out not to overlap. */
export function zoneAt(stations: readonly StationDef[], x: number, y: number): ZoneHit | null {
  for (const s of stations) {
    switch (s.kind) {
      case 'dump':
        // The field itself isn't a zone: pieces are picked up by walking near them.
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
        for (const line of s.lines) if (inRect(line.output, x, y)) return { station: s, zone: 'lineOutput', line };
        break;
      case 'bay':
        if (inRect(s.zones.load, x, y)) return { station: s, zone: 'load' };
        break;
      case 'outlet':
        if (inRect(s.zones.sell, x, y)) return { station: s, zone: 'sell' };
        break;
      case 'staffHut':
        if (inRect(s.zones.hire, x, y)) return { station: s, zone: 'hire' };
        break;
    }
  }
  return null;
}
