import { memoryStorage } from './memoryStorage';
import type { KeyValueStore, Platform } from './Platform';

/** Development and non-portal builds: browser storage, no SDK events. */
export class LocalPlatform implements Platform {
  readonly name = 'local';
  readonly storage = browserStorage();
  readonly locale = navigator.language || 'en';

  loadingStart(): void {}
  loadingStop(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  audioMuted(): boolean {
    return false;
  }
}

/** localStorage, or an in-memory stand-in when the browser blocks it (private mode, blocked site data). */
function browserStorage(): KeyValueStore {
  try {
    const probe = '__scrap-empire-probe__';
    localStorage.setItem(probe, probe);
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    console.warn('localStorage is unavailable; progress will not survive a reload');
    return memoryStorage();
  }
}
