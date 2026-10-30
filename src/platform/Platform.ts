/** The part of the localStorage API that saves need. The CrazyGames Data module has the same shape. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Everything the game needs from the site it runs on. Nothing outside src/platform talks to a portal SDK.
 * Ads join this interface in M5.
 */
export interface Platform {
  readonly name: 'local' | 'crazygames';
  readonly storage: KeyValueStore;
  /** BCP 47 locale such as "en-US". */
  readonly locale: string;
  loadingStart(): void;
  loadingStop(): void;
  /** Call when play starts or resumes after a menu or pause. */
  gameplayStart(): void;
  /** Call at every break in play (menu, pause). Not for tab switches; the portal handles those. */
  gameplayStop(): void;
  /** True when the portal wants the game silent, whatever the in-game sound setting says. */
  audioMuted(): boolean;
}
