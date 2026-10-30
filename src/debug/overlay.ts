import type Phaser from 'phaser';
import type { GameContext } from '../context';
import { SCENE } from '../view/keys';

const REFRESH_MS = 250;

/**
 * Developer readout: frame rate, simulation cost, object count, canvas size.
 * Shown by default in dev builds or with ?debug in the URL; the ` key toggles it.
 */
export class DebugOverlay {
  private readonly el: HTMLPreElement;

  constructor(
    layer: HTMLElement,
    private readonly game: Phaser.Game,
    private readonly ctx: GameContext,
  ) {
    this.el = document.createElement('pre');
    this.el.className = 'debug-overlay';
    this.el.hidden = !(import.meta.env.DEV || new URLSearchParams(location.search).has('debug'));
    layer.append(this.el);

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') this.el.hidden = !this.el.hidden;
    });
    setInterval(() => this.render(), REFRESH_MS);
  }

  private render(): void {
    if (this.el.hidden) return;
    const { sim, platform } = this.ctx;
    const world = this.game.scene.getScene(SCENE.world) as Phaser.Scene | null;
    const p = sim.state.player;
    this.el.textContent = [
      `fps     ${this.game.loop.actualFps.toFixed(0)}`,
      `sim     ${sim.lastAdvanceMs.toFixed(2)} ms/frame`,
      `tick    ${sim.state.tick}`,
      `objects ${world?.children?.length ?? 0}`,
      `canvas  ${this.game.scale.width}×${this.game.scale.height}  zoom ${world?.cameras?.main?.zoom.toFixed(2) ?? '-'}`,
      `player  ${p.x.toFixed(2)}, ${p.y.toFixed(2)} ${p.facing}`,
      `platform ${platform.name}`,
    ].join('\n');
  }
}
