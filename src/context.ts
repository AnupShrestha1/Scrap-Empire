import type { InputManager } from './input';
import type { Platform } from './platform';
import type { Simulation } from './sim/simulation';
import type { Sfx } from './audio/sfx';
import type { SettingsStore } from './settings';
import type { Hud } from './ui/hud';
import type { Toasts } from './ui/toasts';

/** Shared services handed to every scene. */
export interface GameContext {
  readonly platform: Platform;
  readonly sim: Simulation;
  readonly input: InputManager;
  readonly hud: Hud;
  readonly toasts: Toasts;
  readonly sfx: Sfx;
  readonly settings: SettingsStore;
}
