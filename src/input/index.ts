import type { Vec2 } from '../sim/vec';
import { Joystick } from './joystick';
import { KeyboardInput } from './keyboard';

export class InputManager {
  private readonly keyboard: KeyboardInput;
  private readonly joystick: Joystick;

  /** `surface` receives touches for the joystick; `layer` is the UI overlay that draws it. */
  constructor(win: Window, surface: HTMLElement, layer: HTMLElement) {
    this.keyboard = new KeyboardInput(win);
    this.joystick = new Joystick(surface, layer);
  }

  /** Writes the movement direction into `out`, length 0..1. The keyboard wins if both are in use. */
  readMove(out: Vec2): Vec2 {
    this.keyboard.read(out);
    if (out.x === 0 && out.y === 0) this.joystick.read(out);
    const len = Math.hypot(out.x, out.y);
    if (len > 1) {
      out.x /= len;
      out.y /= len;
    }
    return out;
  }
}
