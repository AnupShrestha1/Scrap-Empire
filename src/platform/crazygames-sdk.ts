// The parts of the CrazyGames HTML5 SDK v3 that the game uses. https://docs.crazygames.com/sdk/intro/

export interface CrazyGamesSdk {
  init(): Promise<void>;
  /** 'local' on localhost, 'crazygames' on their domains, 'disabled' anywhere else (calls throw). */
  readonly environment: 'local' | 'crazygames' | 'disabled';
  readonly game: {
    loadingStart(): void;
    loadingStop(): void;
    gameplayStart(): void;
    gameplayStop(): void;
  };
  /** Mirrors localStorage: guests are stored locally, logged-in players sync to their account. 1 MB limit. */
  readonly data: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
  };
  readonly user: {
    readonly systemInfo?: { readonly locale?: string };
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CrazyGamesSdk };
  }
}
