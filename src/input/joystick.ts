import { INPUT } from '../config';
import type { Vec2 } from '../sim/vec';

/**
 * Floating joystick: press anywhere on the game and drag. The base appears under the finger and is pulled
 * along when dragged past its rim, so changing direction never needs a reach back. Mouse drags work too.
 */
export class Joystick {
  private pointerId: number | null = null;
  private baseX = 0;
  private baseY = 0;
  private x = 0;
  private y = 0;
  private readonly base: HTMLDivElement;
  private readonly knob: HTMLDivElement;

  constructor(
    private readonly surface: HTMLElement,
    layer: HTMLElement,
  ) {
    const r = INPUT.joystickRadiusPx;
    const knobR = Math.round(r * 0.45);
    this.base = document.createElement('div');
    this.base.className = 'joystick-base';
    Object.assign(this.base.style, { width: `${r * 2}px`, height: `${r * 2}px`, margin: `${-r}px 0 0 ${-r}px` });
    this.knob = document.createElement('div');
    this.knob.className = 'joystick-knob';
    Object.assign(this.knob.style, { width: `${knobR * 2}px`, height: `${knobR * 2}px`, margin: `${-knobR}px 0 0 ${-knobR}px` });
    this.base.append(this.knob);
    layer.append(this.base);

    surface.addEventListener('pointerdown', this.onDown);
    surface.addEventListener('pointermove', this.onMove);
    surface.addEventListener('pointerup', this.onUp);
    surface.addEventListener('pointercancel', this.onUp);
  }

  /** Writes the stick direction into `out`; length 0..1. */
  read(out: Vec2): Vec2 {
    out.x = this.x;
    out.y = this.y;
    return out;
  }

  private readonly onDown = (e: PointerEvent): void => {
    if (this.pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    this.pointerId = e.pointerId;
    try {
      // Keeps the drag ours even when the finger slides off the game area.
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      // The pointer was already released; the pointerup that follows resets the stick.
    }
    this.baseX = e.clientX;
    this.baseY = e.clientY;
    this.base.classList.add('active');
    this.update(e.clientX, e.clientY);
  };

  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.pointerId) this.update(e.clientX, e.clientY);
  };

  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.x = 0;
    this.y = 0;
    this.base.classList.remove('active');
  };

  private update(px: number, py: number): void {
    const r = INPUT.joystickRadiusPx;
    let dx = px - this.baseX;
    let dy = py - this.baseY;
    let dist = Math.hypot(dx, dy);
    if (dist > r) {
      const pull = (dist - r) / dist;
      this.baseX += dx * pull;
      this.baseY += dy * pull;
      dx = px - this.baseX;
      dy = py - this.baseY;
      dist = r;
    }
    this.base.style.transform = `translate(${this.baseX}px, ${this.baseY}px)`;
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;

    const { joystickDeadZone: dead, joystickFullAt: full } = INPUT;
    const strength = Math.min(1, Math.max(0, (dist / r - dead) / (full - dead)));
    if (strength === 0) {
      this.x = 0;
      this.y = 0;
      return;
    }
    this.x = (dx / dist) * strength;
    this.y = (dy / dist) * strength;
  }
}
