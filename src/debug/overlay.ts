import type Phaser from 'phaser';
import type { GameContext } from '../context';
import { SCENE } from '../view/keys';

const REFRESH_MS = 250;
const SPEEDS = [1, 4, 16] as const;

export interface DebugActions {
  /** Wipes the save and reloads into a new game. */
  resetSave(): void;
}

/**
 * Developer readout (frame rate, simulation cost, objects, canvas) plus tuning tools: game speed and
 * save reset. Shown by default in dev builds or with ?debug in the URL; the ` key toggles it.
 */
export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private readonly readout: HTMLPreElement;
  private readonly speedButton: HTMLButtonElement;

  constructor(
    layer: HTMLElement,
    private readonly game: Phaser.Game,
    private readonly ctx: GameContext,
    actions: DebugActions,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'debug-overlay';
    this.el.hidden = !(import.meta.env.DEV || new URLSearchParams(location.search).has('debug'));
    this.readout = document.createElement('pre');

    const tools = document.createElement('div');
    tools.className = 'debug-tools';
    this.speedButton = button('Speed ×1', () => this.cycleSpeed());
    tools.append(
      this.speedButton,
      button('+$100', () => {
        ctx.sim.state.money += 100;
        ctx.sim.dirty = true;
      }),
      button('Reset save', () => {
        if (confirm('Delete this save and start a new game?')) actions.resetSave();
      }),
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
    const world = this.game.scene.getScene(SCENE.world) as Phaser.Scene | null;
    const { player, truck } = sim.state;
    this.readout.textContent = [
      `fps     ${this.game.loop.actualFps.toFixed(0)}`,
      `sim     ${sim.lastAdvanceMs.toFixed(2)} ms/frame`,
      `tick    ${sim.state.tick}`,
      `objects ${world?.children?.length ?? 0}`,
      `canvas  ${this.game.scale.width}×${this.game.scale.height}  zoom ${world?.cameras?.main?.zoom.toFixed(2) ?? '-'}`,
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
