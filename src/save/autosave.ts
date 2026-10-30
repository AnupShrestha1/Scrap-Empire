import { SAVE } from '../config';
import type { Simulation } from '../sim/simulation';
import type { GameState } from '../sim/state';
import type { SaveManager } from './saveManager';

/**
 * Saves on a timer when something changed, and always when the page is hidden or closed
 * (the play-time counter changes every tick, so there is always something new by then).
 */
export class AutoSaver {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly saves: SaveManager<GameState>,
    private readonly sim: Simulation,
    private readonly intervalMs: number = SAVE.autosaveMs,
  ) {}

  start(): void {
    if (this.timer !== null) return;
    this.timer = setInterval(this.saveIfDirty, this.intervalMs);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('pagehide', this.saveNow);
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('pagehide', this.saveNow);
  }

  /** Saves immediately, e.g. right after a purchase. */
  readonly saveNow = (): void => {
    if (this.saves.save(this.sim.state)) this.sim.dirty = false;
  };

  private readonly saveIfDirty = (): void => {
    if (this.sim.dirty) this.saveNow();
  };

  private readonly onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.saveNow();
  };
}
