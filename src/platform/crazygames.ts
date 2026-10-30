import type { CrazyGamesSdk } from './crazygames-sdk';
import type { KeyValueStore, Platform } from './Platform';

export class CrazyGamesPlatform implements Platform {
  readonly name = 'crazygames';
  readonly storage: KeyValueStore;
  readonly locale: string;

  constructor(private readonly sdk: CrazyGamesSdk) {
    this.storage = sdk.data;
    this.locale = sdk.user.systemInfo?.locale || 'en';
  }

  loadingStart(): void {
    this.sdk.game.loadingStart();
  }

  loadingStop(): void {
    this.sdk.game.loadingStop();
  }

  gameplayStart(): void {
    this.sdk.game.gameplayStart();
  }

  gameplayStop(): void {
    this.sdk.game.gameplayStop();
  }

  audioMuted(): boolean {
    return this.sdk.game.settings?.muteAudio === true;
  }
}
