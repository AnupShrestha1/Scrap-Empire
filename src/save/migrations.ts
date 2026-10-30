/** Current save format. Bump it, and add a migration, whenever GameState changes shape. */
export const SAVE_VERSION = 1;

export type Migration = (state: unknown) => unknown;

/** `migrations[n]` upgrades a state saved at version n to version n + 1. */
export type Migrations = Readonly<Record<number, Migration>>;

export const MIGRATIONS: Migrations = {};

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
