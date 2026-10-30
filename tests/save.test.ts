import { describe, expect, it } from 'vitest';
import { memoryStorage } from '../src/platform/memoryStorage';
import type { KeyValueStore } from '../src/platform/Platform';
import { migrate } from '../src/save/migrations';
import { SAVE_KEYS, SaveManager, type SaveManagerOptions } from '../src/save/saveManager';

interface Toy {
  coins: number;
}
const isToy = (s: unknown): s is Toy => typeof (s as Toy | null)?.coins === 'number';

function setup(options: Partial<SaveManagerOptions> = {}, store: KeyValueStore = memoryStorage()) {
  let clock = 1_000_000;
  const saves = new SaveManager(store, isToy, { backupIntervalMs: 1000, now: () => clock, ...options });
  return { store, saves, tick: (ms: number) => (clock += ms) };
}

describe('SaveManager', () => {
  it('round-trips a state', () => {
    const { saves, store } = setup();
    expect(saves.save({ coins: 5 })).toBe(true);
    const loaded = new SaveManager(store, isToy).load();
    expect(loaded).toMatchObject({ state: { coins: 5 }, fromBackup: false });
  });

  it('returns null when there is no save', () => {
    expect(setup().saves.load()).toBeNull();
  });

  it('copies the last good save to the backup slot at most once per interval', () => {
    const { saves, store, tick } = setup();
    saves.save({ coins: 1 });
    expect(store.getItem(SAVE_KEYS.backup)).toBeNull();
    saves.save({ coins: 2 });
    expect(JSON.parse(store.getItem(SAVE_KEYS.backup)!).state.coins).toBe(1);
    tick(500);
    saves.save({ coins: 3 });
    expect(JSON.parse(store.getItem(SAVE_KEYS.backup)!).state.coins).toBe(1);
    tick(600);
    saves.save({ coins: 4 });
    expect(JSON.parse(store.getItem(SAVE_KEYS.backup)!).state.coins).toBe(3);
  });

  it('falls back to the backup and keeps the unreadable save', () => {
    const { saves, store } = setup();
    saves.save({ coins: 1 });
    saves.save({ coins: 2 });
    store.setItem(SAVE_KEYS.main, '{"v":1,"savedAt":0,"state":{"coin');

    const loaded = new SaveManager(store, isToy).load();
    expect(loaded).toMatchObject({ state: { coins: 1 }, fromBackup: true });
    expect(store.getItem(SAVE_KEYS.corrupt)).toContain('"coin');
  });

  it('rejects states that fail validation', () => {
    const { store } = setup();
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 1, savedAt: 0, state: { coins: 'lots' } }));
    expect(new SaveManager(store, isToy).load()).toBeNull();
  });

  it('does not load a save from a newer version, and preserves it', () => {
    const { store } = setup();
    const future = JSON.stringify({ v: 99, savedAt: 0, state: { coins: 1 } });
    store.setItem(SAVE_KEYS.main, future);
    expect(new SaveManager(store, isToy).load()).toBeNull();
    expect(store.getItem(SAVE_KEYS.corrupt)).toBe(future);
  });

  it('migrates old saves on load', () => {
    const { store } = setup();
    store.setItem(SAVE_KEYS.main, JSON.stringify({ v: 1, savedAt: 0, state: { gold: 7 } }));
    const migrations = { 1: (s: unknown) => ({ coins: (s as { gold: number }).gold * 10 }) };
    const loaded = new SaveManager(store, isToy, { version: 2, migrations }).load();
    expect(loaded?.state).toEqual({ coins: 70 });
  });

  it('reports failure instead of throwing when storage is full', () => {
    const full: KeyValueStore = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {},
    };
    const { saves } = setup({}, full);
    expect(saves.save({ coins: 1 })).toBe(false);
  });
});

describe('migrate', () => {
  it('chains migrations in order and throws on a gap', () => {
    const migrations = { 1: (s: unknown) => `${s}b`, 2: (s: unknown) => `${s}c` };
    expect(migrate('a', 1, migrations, 3)).toBe('abc');
    expect(() => migrate('a', 1, { 1: migrations[1] }, 3)).toThrow(/from v2/);
  });
});
