// Offline progress (docs/GAME_DESIGN.md §7.8): while the player is away, only the automated part of the
// business keeps going: the employees. Replaying hours tick by tick would be far too slow on a phone, so
// during play the simulation keeps a running estimate of what the employees earn per second (state.autoRate)
// and on return pays that for the time away, at a discount, capped.
import { OFFLINE } from '../data/balance';
import type { GameState } from './state';

export interface OfflineResult {
  /** Time credited, after the cap. */
  seconds: number;
  /** Time actually away. */
  awaySeconds: number;
  amount: number;
}

/** What the employees earned while the player was away for `awayMs`; nothing without employees or under a minute. */
export function offlineEarnings(state: GameState, awayMs: number): OfflineResult | null {
  const awaySeconds = Math.max(0, awayMs / 1000);
  if (state.employees.length === 0 || awaySeconds < OFFLINE.minAwayS) return null;
  const seconds = Math.min(awaySeconds, OFFLINE.capS);
  const amount = Math.floor(state.autoRate * seconds * OFFLINE.efficiency);
  if (amount <= 0) return null;
  return { seconds, awaySeconds, amount };
}
