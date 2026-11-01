import { ITEM_IDS } from '../data/items';

/** Current save format. Bump it, and add a migration, whenever GameState changes shape. */
export const SAVE_VERSION = 11;

export type Migration = (state: unknown) => unknown;

/** `migrations[n]` upgrades a state saved at version n to version n + 1. */
export type Migrations = Readonly<Record<number, Migration>>;

type Json = Record<string, unknown>;

export const MIGRATIONS: Migrations = {
  /**
   * v1 (M0 test yard: position only) → v2 (M1a: carried stack, truck, stations).
   * Station state is left empty; sanitizeState fills it from the current layout.
   */
  1: (state) => {
    const s = state as Json;
    return {
      ...s,
      player: { ...(s.player as Json), stack: [] },
      truck: { phase: 'away', timer: 1, load: 0 },
      piles: {},
      processors: {},
      bins: {},
    };
  },
  /** v2 (M1a) → v3: cash, for selling from bins. */
  2: (state) => ({ ...(state as Json), money: 0 }),
  /** v3 → v4 (M1b): upgrades, objectives and lifetime earnings. */
  3: (state) => {
    const s = state as Json;
    const zero = { carry: 0, shredderSpeed: 0, binSize: 0, supply: 0 };
    return { ...s, earned: s.money, upgrades: { ...zero }, upgradePaid: { ...zero }, objectives: { index: 0, progress: 0 } };
  },
  /** v4 → v5 (M2a): products on processor trays, and machines to build. */
  4: (state) => {
    const s = state as Json;
    const processors: Json = {};
    for (const [id, p] of Object.entries((s.processors as Json) ?? {})) {
      const m = p as Json;
      processors[id] = {
        ...m,
        tray: { sheet: 0, can: 0, ...(m.tray as Json) },
        carry: { sheet: 0, can: 0, ...(m.carry as Json) },
      };
    }
    return { ...s, processors, manufacturers: {}, buildPaid: {} };
  },
  /** v5 → v6: separate machines became production lines in one factory; products now sell instantly. */
  5: (state) => {
    const { manufacturers, ...s } = state as Json;
    const lines: Json = {};
    for (const [id, m] of Object.entries((manufacturers as Json) ?? {})) {
      lines[id] = { built: Boolean((m as Json).built), progress: 0 };
    }
    return { ...s, lines };
  },
  /** v6 → v7 (M2b): copper on processor trays; yield, extraction and line speed upgrades. */
  6: (state) => {
    const s = state as Json;
    const processors: Json = {};
    for (const [id, p] of Object.entries((s.processors as Json) ?? {})) {
      const m = p as Json;
      processors[id] = { ...m, tray: { copper: 0, ...(m.tray as Json) }, carry: { copper: 0, ...(m.carry as Json) } };
    }
    const extra = { shredderYield: 0, extraction: 0, pressSpeed: 0, canSpeed: 0 };
    return {
      ...s,
      processors,
      upgrades: { ...extra, ...(s.upgrades as Json) },
      upgradePaid: { ...extra, ...(s.upgradePaid as Json) },
    };
  },
  /** v7 → v8: the scrap pile became a dump site with scattered pieces; the Magnet upgrade. */
  7: (state) => {
    const { piles, ...s } = state as Json;
    let units = 0;
    for (const p of Object.values((piles as Json) ?? {})) units += Number((p as Json).items) || 0;
    return {
      ...s,
      field: { pieces: [], seed: 20261031, nextId: 0, pendingUnits: units },
      upgrades: { magnet: 0, ...(s.upgrades as Json) },
      upgradePaid: { magnet: 0, ...(s.upgradePaid as Json) },
    };
  },
  /** v8 → v9 (M3a): line output spots and loading bay trucks. */
  8: (state) => {
    const s = state as Json;
    const lines: Json = {};
    for (const [id, l] of Object.entries((s.lines as Json) ?? {})) lines[id] = { ...(l as Json), out: 0 };
    return { ...s, lines, bays: {} };
  },
  /** v9 → v10 (M3b): employees. */
  9: (state) => ({ ...(state as Json), employees: [], hirePaid: 0 }),
  /**
   * v10 → v11 (P1): six metals and twelve products; factory line slots that make a chosen product (the
   * press and can line become lines 1 and 2); one line speed upgrade; a new objective chain; the shredder's
   * warm start and the first-truck flag. Item counts for new items are filled in as zero.
   */
  10: (state) => {
    const s = state as Json;
    const zeroItems = Object.fromEntries(ITEM_IDS.map((id) => [id, 0]));
    const processors: Json = {};
    for (const [id, p] of Object.entries((s.processors as Json) ?? {})) {
      const m = p as Json;
      processors[id] = { ...m, tray: { ...zeroItems, ...(m.tray as Json) }, carry: { ...zeroItems, ...(m.carry as Json) }, shredded: 999 };
    }
    const old = (s.lines as Record<string, Json | undefined>) ?? {};
    const slot = (l: Json | undefined, product: string) => ({
      built: Boolean(l?.built),
      product,
      progress: 0,
      out: Number(l?.out) || 0,
      outItem: Number(l?.out) > 0 ? product : null,
    });
    const lines = { 'line-1': slot(old.press, 'sheet'), 'line-2': slot(old['can-line'], 'can') };
    const speed = (u: unknown) => {
      const { pressSpeed, canSpeed, ...rest } = (u as Json) ?? {};
      return { ...rest, lineSpeed: Math.max(Number(pressSpeed) || 0, Number(canSpeed) || 0) };
    };
    const upgradePaid = { ...speed(s.upgradePaid), lineSpeed: 0 };
    // The objective chain was rewritten: experienced saves pick it up at the factory steps.
    const objectives = { index: Number((s.objectives as Json)?.index) >= 8 ? 10 : 0, progress: 0 };
    return {
      ...s,
      processors,
      lines,
      buildPaid: {},
      upgrades: speed(s.upgrades),
      upgradePaid,
      objectives,
      firstOrder: lines['line-1'].built || lines['line-2'].built,
    };
  },
};

/** Runs every migration from `from` up to `to`. Throws if one is missing. */
export function migrate(
  state: unknown,
  from: number,
  migrations: Migrations = MIGRATIONS,
  to: number = SAVE_VERSION,
): unknown {
  let current = state;
  for (let v = from; v < to; v++) {
    const step = migrations[v];
    if (!step) throw new Error(`No save migration from v${v} to v${v + 1}`);
    current = step(current);
  }
  return current;
}
