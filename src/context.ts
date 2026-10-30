import type { InputManager } from './input';
import type { Platform } from './platform';
import type { Simulation } from './sim/simulation';

/** Shared services handed to every scene. */
export interface GameContext {
  readonly platform: Platform;
  readonly sim: Simulation;
  readonly input: InputManager;
}
