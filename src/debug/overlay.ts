import type { GameContext } from '../context';

const REFRESH_MS = 250;
const SPEEDS = [1, 4, 16] as const;
/** How long the reset button waits for its second tap. */
const RESET_CONFIRM_MS = 3000;

export interface DebugActions {
  /** Wipes the save and reloads into a new game. */
  resetSave(): void;
  /** Renderer readout lines (frame rate, draw calls and so on). */
  viewLines(): string[];
}

/**
 * Developer readout (frame rate, simulation cost, objects, canvas) plus tuning tools: game speed and
 * save reset. Shown by default in dev builds or with ?debug in the URL; the ` key toggles it.
 */
export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private readonly readout: HTMLPreElement;
  private readonly speedButton: HTMLButtonElement;
  /**
   * Asks for a second tap instead of confirm(): embedded browsers (the CrazyGames iframe, many phones)
   * block dialogs, and a blocked confirm() answers "no" without showing anything.
   */
  private readonly resetButton: HTMLButtonElement;
  private resetArmedUntil = 0;

  constructor(
    layer: HTMLElement,
    private readonly ctx: GameContext,
    private readonly actions: DebugActions,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'debug-overlay';
    this.el.hidden = !(import.meta.env.DEV || new URLSearchParams(location.search).has('debug'));
    this.readout = document.createElement('pre');

    const tools = document.createElement('div');
    tools.className = 'debug-tools';
    this.speedButton = button('Speed ×1', () => this.cycleSpeed());
    this.resetButton = button('Reset save', () => {
      if (performance.now() < this.resetArmedUntil) {
        actions.resetSave();
        return;
      }
      this.resetArmedUntil = performance.now() + RESET_CONFIRM_MS;
      this.resetButton.textContent = 'Tap again to reset';
      setTimeout(() => {
        this.resetButton.textContent = 'Reset save';
      }, RESET_CONFIRM_MS);
    });
    tools.append(
      this.speedButton,
      button('+$100', () => {
        ctx.sim.state.money += 100;
        ctx.sim.dirty = true;
      }),
      this.resetButton,
    );
    this.el.append(this.readout, tools);
    layer.append(this.el);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') this.el.hidden = !this.el.hidden;
    });
    setInterval(() => this.render(), REFRESH_MS);
  }

  private cycleSpeed(): void {
    const { sim } = this.ctx;
    const next = SPEEDS[(SPEEDS.indexOf(sim.timeScale as (typeof SPEEDS)[number]) + 1) % SPEEDS.length]!;
    sim.timeScale = next;
    this.speedButton.textContent = `Speed ×${next}`;
  }

  private render(): void {
    if (this.el.hidden) return;
    const { sim, platform } = this.ctx;
    const { player, truck } = sim.state;
    this.readout.textContent = [
      ...this.actions.viewLines(),
      `sim     ${sim.lastAdvanceMs.toFixed(2)} ms/frame`,
      `tick    ${sim.state.tick}`,
      `player  ${player.x.toFixed(2)}, ${player.y.toFixed(2)} ${player.facing}  carrying ${player.stack.length}`,
      `truck   ${truck.phase} (${truck.timer}) load ${truck.load}`,
      `platform ${platform.name}`,
    ].join('\n');
  }
}

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
