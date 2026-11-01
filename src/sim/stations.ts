import type { ProcessorRecipe } from '../data/balance';
import type { MetalId } from '../data/items';
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
  /** A machine bought later (on its `build` zone) rather than there from the start. */
  build?: { cost: number; requiresLevel: number };
  zones: { input: Rect; output: Rect; build?: Rect };
}

/**
 * Storage for one metal. Standing in a deposit zone puts carried metal into whichever of the bins around
 * you takes it; production lines draw from the bins directly. Metal is sold at the Scrap Dealer.
 */
export interface BinDef extends StationBase {
  kind: 'bin';
  item: MetalId;
  capacity: number;
  zones: { deposit: Rect };
}

/**
 * One line slot in the factory. Slots are bought in order on the factory's build pad; each built line
 * makes whichever product it's set to (on the factory's recipe pad), pulling metals from the bins.
 */
export interface LineDef {
  id: string;
  buildCost: number;
  /** Business level needed before it can be bought. */
  requiresLevel?: number;
  /** Where its products come out, to be picked up. */
  output: Rect;
}

/**
 * The factory: one building with line slots. `build` sells the next slot; standing on `recipes` opens
 * the card for choosing what each line makes.
 */
export interface FactoryDef extends StationBase {
  kind: 'factory';
  lines: readonly LineDef[];
  /** The upgrade that speeds every line up. */
  speedUpgrade?: UpgradeId;
  zones: { build: Rect; recipes: Rect };
}

/** The Scrap Dealer: `sell` buys every raw metal the player carries; `stock` sells metal from the bins. */
export interface DealerDef extends StationBase {
  kind: 'dealer';
  zones: { sell: Rect; stock: Rect };
}

/** A loading bay lane: buyer trucks back in to `lane.parkX` on `lane.row`; load them from `zones.load`. */
export interface BayDef extends StationBase {
  kind: 'bay';
  /** Business level before trucks use this lane. */
  requiresLevel?: number;
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

export type StationDef = DumpDef | ProcessorDef | BinDef | CashPadDef | FactoryDef | BayDef | OutletDef | StaffHutDef | DealerDef;

export type ZoneHit =
  | { station: DumpDef; zone: 'return' }
  | { station: ProcessorDef; zone: 'input' | 'output' }
  | { station: ProcessorDef; zone: 'buildMachine' }
  | { station: BinDef; zone: 'deposit' }
  | { station: CashPadDef; zone: 'buy' }
  | { station: FactoryDef; zone: 'build' }
  | { station: FactoryDef; zone: 'recipes' }
  | { station: DealerDef; zone: 'sell' }
  | { station: DealerDef; zone: 'stock' }
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
        if (s.zones.build && inRect(s.zones.build, x, y)) return { station: s, zone: 'buildMachine' };
        if (inRect(s.zones.input, x, y)) return { station: s, zone: 'input' };
        if (inRect(s.zones.output, x, y)) return { station: s, zone: 'output' };
        break;
      case 'bin':
        if (inRect(s.zones.deposit, x, y)) return { station: s, zone: 'deposit' };
        break;
      case 'cashPad':
        if (inRect(s.zones.buy, x, y)) return { station: s, zone: 'buy' };
        break;
      case 'factory':
        if (inRect(s.zones.build, x, y)) return { station: s, zone: 'build' };
        if (inRect(s.zones.recipes, x, y)) return { station: s, zone: 'recipes' };
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
      case 'dealer':
        if (inRect(s.zones.sell, x, y)) return { station: s, zone: 'sell' };
        if (inRect(s.zones.stock, x, y)) return { station: s, zone: 'stock' };
        break;
    }
  }
  return null;
}
