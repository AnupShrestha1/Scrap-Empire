import { t } from '../i18n';
import type { GameState } from '../sim/state';

/** The always-visible chips at the top of the screen. M1 shows cash; more join in M1b. */
export class Hud {
  private readonly cash: HTMLSpanElement;
  private shownMoney = -1;

  constructor(layer: HTMLElement) {
    const bar = document.createElement('div');
    bar.className = 'hud';
    const chip = document.createElement('div');
    chip.className = 'hud-chip';
    chip.setAttribute('aria-label', t('hud.cash'));
    const coin = document.createElement('span');
    coin.className = 'hud-coin';
    coin.textContent = '$';
    this.cash = document.createElement('span');
    this.cash.className = 'hud-value';
    chip.append(coin, this.cash);
    bar.append(chip);
    layer.append(bar);
  }

  update(state: GameState): void {
    if (state.money === this.shownMoney) return;
    this.shownMoney = state.money;
    this.cash.textContent = state.money.toLocaleString('en-US');
  }
}
