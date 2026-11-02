import { t, type StringKey } from '../i18n';
import type { SettingsStore } from '../settings';
import { currentObjective } from '../sim/systems/objectives';
import { BUSINESS_LEVELS, businessLevel } from '../data/balance';
import type { GameState } from '../sim/state';

const ICON_SOUND_ON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
const ICON_SOUND_OFF =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_HINT =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" fill="currentColor"/><path d="M9.5 19h5M10.5 21.5h3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

const ICON_DROP =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11M7 10l5 5 5-5" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 18h16v3H4z" fill="currentColor"/></svg>';

/** The always-visible HUD: cash, the current objective, and sound and hint toggles. */
export class Hud {
  private readonly cash: HTMLSpanElement;
  private readonly level: HTMLSpanElement;
  private readonly levelFill: HTMLSpanElement;
  /** What the next business level opens, under the level bar. */
  private readonly next: HTMLSpanElement;
  private readonly objective: HTMLDivElement;
  private readonly objectiveText: HTMLSpanElement;
  private readonly objectiveCount: HTMLSpanElement;
  private readonly objectiveReward: HTMLSpanElement;
  private readonly soundButton: HTMLButtonElement;
  private readonly hintButton: HTMLButtonElement;
  private readonly dropButton: HTMLButtonElement;
  private shown = '';

  constructor(
    layer: HTMLElement,
    private readonly settings: SettingsStore,
    onDrop: () => void,
  ) {
    const bar = el('div', 'hud');
    const chip = el('div', 'hud-chip');
    chip.setAttribute('aria-label', t('hud.cash'));
    const coin = el('span', 'hud-coin');
    coin.textContent = '$';
    this.cash = el('span', 'hud-value');
    chip.append(coin, this.cash);

    const levelChip = el('div', 'hud-chip hud-level');
    this.level = el('span', 'hud-level-text');
    const track = el('span', 'hud-level-track');
    this.levelFill = el('span', 'hud-level-fill');
    track.append(this.levelFill);
    this.next = el('span', 'hud-next');
    levelChip.append(this.level, track, this.next);
    const chips = el('div', 'hud-chips');
    chips.append(chip, levelChip);

    this.objective = el('div', 'hud-objective');
    this.objectiveText = el('span', 'hud-objective-text');
    this.objectiveCount = el('span', 'hud-objective-count');
    this.objectiveReward = el('span', 'hud-objective-reward');
    this.objective.append(this.objectiveText, this.objectiveCount, this.objectiveReward);
    bar.append(chips, this.objective);

    const buttons = el('div', 'hud-buttons');
    this.soundButton = iconButton(() => this.toggle('sound'));
    this.hintButton = iconButton(() => this.toggle('hints'));
    this.hintButton.innerHTML = ICON_HINT;
    buttons.append(this.soundButton, this.hintButton);

    // Drop everything carried, from the left edge where a thumb can reach it (Q on a keyboard).
    this.dropButton = el('button', 'hud-drop');
    this.dropButton.type = 'button';
    this.dropButton.innerHTML = `${ICON_DROP}<span>${t('hud.drop')}</span>`;
    this.dropButton.setAttribute('aria-label', t('hud.dropLabel'));
    this.dropButton.addEventListener('click', onDrop);
    this.dropButton.addEventListener('pointerdown', (e) => e.stopPropagation());
    layer.append(bar, buttons, this.dropButton);
    this.refreshButtons();
  }

  update(state: GameState): void {
    this.dropButton.disabled = state.player.stack.length === 0;
    const objective = currentObjective(state);
    const key = `${state.money}|${state.earned}|${state.objectives.index}|${state.objectives.progress}`;
    if (key === this.shown) return;
    this.shown = key;
    this.cash.textContent = state.money.toLocaleString('en-US');
    const level = businessLevel(state.earned);
    this.level.textContent = t('hud.level', { level });
    const from = BUSINESS_LEVELS[level - 1] ?? 0;
    const to = BUSINESS_LEVELS[level];
    this.levelFill.style.width = to === undefined ? '100%' : `${Math.round(((state.earned - from) / (to - from)) * 100)}%`;
    this.next.textContent = to === undefined ? '' : t('hud.next', { what: t(`next.${level + 1}` as StringKey) });
    this.objective.hidden = !objective;
    if (!objective) return;
    this.objectiveText.textContent = t(`objective.${objective.id}` as StringKey);
    this.objectiveCount.textContent = objective.target > 1 ? `${Math.min(state.objectives.progress, objective.target)}/${objective.target}` : '';
    this.objectiveReward.textContent = `+$${objective.reward}`;
  }

  private toggle(setting: 'sound' | 'hints'): void {
    this.settings.set({ [setting]: !this.settings.value[setting] });
    this.refreshButtons();
  }

  private refreshButtons(): void {
    const { sound, hints } = this.settings.value;
    this.soundButton.innerHTML = sound ? ICON_SOUND_ON : ICON_SOUND_OFF;
    this.soundButton.setAttribute('aria-label', t(sound ? 'hud.soundOff' : 'hud.soundOn'));
    this.soundButton.setAttribute('aria-pressed', String(sound));
    this.hintButton.setAttribute('aria-label', t(hints ? 'hud.hintsOff' : 'hud.hintsOn'));
    this.hintButton.setAttribute('aria-pressed', String(hints));
    this.hintButton.classList.toggle('off', !hints);
    this.soundButton.classList.toggle('off', !sound);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function iconButton(onClick: () => void): HTMLButtonElement {
  const b = el('button', 'hud-button');
  b.type = 'button';
  b.addEventListener('click', onClick);
  // Don't let a tap on the button also start the joystick underneath.
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  return b;
}
