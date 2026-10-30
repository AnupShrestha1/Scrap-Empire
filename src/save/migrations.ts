/** Current save format. Bump it, and add a migration, whenever GameState changes shape. */
export const SAVE_VERSION = 4;

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
