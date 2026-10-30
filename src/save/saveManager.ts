import { SAVE } from '../config';
import type { KeyValueStore } from '../platform/Platform';
import { MIGRATIONS, SAVE_VERSION, migrate, type Migrations } from './migrations';

export const SAVE_KEYS = {
  main: `${SAVE.keyPrefix}save`,
  backup: `${SAVE.keyPrefix}save_backup`,
  /** Last unreadable save, kept for debugging instead of being overwritten. */
  corrupt: `${SAVE.keyPrefix}save_corrupt`,
} as const;

interface Envelope {
  v: number;
  savedAt: number;
  state: unknown;
}

export interface LoadedSave<T> {
  state: T;
  savedAt: number;
  fromBackup: boolean;
}

export interface SaveManagerOptions {
  version: number;
  migrations: Migrations;
  backupIntervalMs: number;
  now: () => number;
}

type ReadResult<T> = { ok: true; raw: string; value: LoadedSave<T> } | { ok: false; raw: string | null };

/**
 * Versioned saves in a key-value store (localStorage, or the CrazyGames Data module).
 * Keeps a backup of the last good save and never throws on storage errors.
 */
export class SaveManager<T> {
  private readonly opts: SaveManagerOptions;
  private lastGoodRaw: string | null = null;
  private lastBackupAt = -Infinity;

  constructor(
    private readonly store: KeyValueStore,
    private readonly validate: (state: unknown) => state is T,
    options: Partial<SaveManagerOptions> = {},
  ) {
    this.opts = {
      version: SAVE_VERSION,
      migrations: MIGRATIONS,
      backupIntervalMs: SAVE.backupMs,
      now: Date.now,
      ...options,
    };
  }

  /** Loads the main save, falling back to the backup. Returns null when neither is usable. */
  load(): LoadedSave<T> | null {
    const main = this.read(SAVE_KEYS.main, false);
    if (main.ok) {
      this.lastGoodRaw = main.raw;
      return main.value;
    }
    if (main.raw !== null) this.write(SAVE_KEYS.corrupt, main.raw);

    const backup = this.read(SAVE_KEYS.backup, true);
    if (backup.ok) {
      this.lastGoodRaw = backup.raw;
      return backup.value;
    }
    return null;
  }

  /** Writes the state. At most every `backupIntervalMs`, the previous good save is copied to the backup first. */
  save(state: T): boolean {
    const now = this.opts.now();
    if (this.lastGoodRaw !== null && now - this.lastBackupAt >= this.opts.backupIntervalMs) {
      if (this.write(SAVE_KEYS.backup, this.lastGoodRaw)) this.lastBackupAt = now;
    }
    const envelope: Envelope = { v: this.opts.version, savedAt: now, state };
    const raw = JSON.stringify(envelope);
    if (!this.write(SAVE_KEYS.main, raw)) return false;
    this.lastGoodRaw = raw;
    return true;
  }

  private read(key: string, fromBackup: boolean): ReadResult<T> {
    let raw: string | null;
    try {
      raw = this.store.getItem(key);
    } catch {
      return { ok: false, raw: null };
    }
    if (raw === null) return { ok: false, raw };

    try {
      const envelope: unknown = JSON.parse(raw);
      // A save from a newer build can't be read here; treat it as unreadable rather than guess.
      if (!isEnvelope(envelope) || envelope.v > this.opts.version) return { ok: false, raw };
      const state = migrate(envelope.state, envelope.v, this.opts.migrations, this.opts.version);
      if (!this.validate(state)) return { ok: false, raw };
      return { ok: true, raw, value: { state, savedAt: envelope.savedAt, fromBackup } };
    } catch {
      return { ok: false, raw };
    }
  }

  private write(key: string, value: string): boolean {
    try {
      this.store.setItem(key, value);
      return true;
    } catch (err) {
      console.warn(`Could not write ${key}`, err);
      return false;
    }
  }
}

function isEnvelope(value: unknown): value is Envelope {
  if (typeof value !== 'object' || value === null) return false;
  const { v, savedAt } = value as Partial<Envelope>;
  return Number.isInteger(v) && (v as number) >= 1 && typeof savedAt === 'number' && 'state' in value;
}
