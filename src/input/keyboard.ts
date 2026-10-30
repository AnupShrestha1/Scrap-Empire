import type { Vec2 } from '../sim/vec';

/** Movement keys by physical position (KeyboardEvent.code), so WASD is ZQSD on AZERTY without remapping. */
const MOVE_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Keys that would otherwise scroll the portal page around the game iframe. */
const NO_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class KeyboardInput {
  private readonly held = new Set<string>();

  constructor(private readonly target: Window) {
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
  }

  /** Writes the held direction into `out`, each axis -1..1. */
  read(out: Vec2): Vec2 {
    let x = 0;
    let y = 0;
    for (const code of this.held) {
      const dir = MOVE_KEYS[code];
      if (!dir) continue;
      x += dir[0];
      y += dir[1];
    }
    out.x = Math.max(-1, Math.min(1, x));
    out.y = Math.max(-1, Math.min(1, y));
    return out;
  }

  destroy(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.onBlur);
  }

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (NO_DEFAULT.has(e.code)) e.preventDefault();
    if (e.code in MOVE_KEYS && !e.ctrlKey && !e.metaKey && !e.altKey) this.held.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.held.delete(e.code);
  };

  /** Keys released while the window is unfocused never send keyup, so drop everything. */
  private readonly onBlur = (): void => {
    this.held.clear();
  };
}
