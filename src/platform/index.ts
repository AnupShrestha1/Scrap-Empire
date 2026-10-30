import { CrazyGamesPlatform } from './crazygames';
import { LocalPlatform } from './local';
import type { Platform } from './Platform';

export type { KeyValueStore, Platform } from './Platform';

const SDK_INIT_TIMEOUT_MS = 5000;

/**
 * Uses the CrazyGames SDK when the page loaded it (`--mode crazygames` builds) and it works on this domain.
 * Anything else, including a failed or slow SDK, falls back to the local platform so the game still runs.
 */
export async function createPlatform(): Promise<Platform> {
  const sdk = window.CrazyGames?.SDK;
  if (sdk) {
    try {
      await withTimeout(sdk.init(), SDK_INIT_TIMEOUT_MS);
      if (sdk.environment !== 'disabled') return new CrazyGamesPlatform(sdk);
      console.warn('CrazyGames SDK is disabled on this domain; using the local platform');
    } catch (err) {
      console.warn('CrazyGames SDK failed to start; using the local platform', err);
    }
  }
  return new LocalPlatform();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out after ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
