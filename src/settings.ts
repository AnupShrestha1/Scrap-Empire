import { SAVE } from './config';
import type { KeyValueStore } from './platform';

/** Player preferences. Kept apart from the game save, so resetting a game keeps them. */
export interface Settings {
  sound: boolean;
  hints: boolean;
}

const KEY = `${SAVE.keyPrefix}settings`;
const DEFAULTS: Settings = { sound: true, hints: true };

export class SettingsStore {
  private current: Settings;

  constructor(private readonly storage: KeyValueStore) {
    this.current = { ...DEFAULTS, ...this.read() };
  }

  get value(): Readonly<Settings> {
    return this.current;
  }

  set(patch: Partial<Settings>): void {
    this.current = { ...this.current, ...patch };
    try {
      this.storage.setItem(KEY, JSON.stringify(this.current));
    } catch {
      // Preferences are nice to keep but not worth interrupting play for.
    }
  }

  private read(): Partial<Settings> {
    try {
      const raw = this.storage.getItem(KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : {};
      if (typeof parsed !== 'object' || parsed === null) return {};
      const { sound, hints } = parsed as Record<string, unknown>;
      return {
        ...(typeof sound === 'boolean' ? { sound } : {}),
        ...(typeof hints === 'boolean' ? { hints } : {}),
      };
    } catch {
      return {};
    }
  }
}
