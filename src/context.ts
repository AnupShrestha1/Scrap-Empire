import type { InputManager } from './input';
import type { Platform } from './platform';
import type { Simulation } from './sim/simulation';
import type { Hud } from './ui/hud';

/** Shared services handed to every scene. */
export interface GameContext {
  readonly platform: Platform;
  readonly sim: Simulation;
  readonly input: InputManager;
  readonly hud: Hud;
}
