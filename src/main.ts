import './ui/styles.css';
import type { GameContext } from './context';
import { YARD } from './data/layout';
import { DebugOverlay } from './debug/overlay';
import { t } from './i18n';
import { InputManager } from './input';
import { createPlatform } from './platform';
import { AutoSaver } from './save/autosave';
import { SaveManager } from './save/saveManager';
import { parseGrid } from './sim/grid';
import { Simulation } from './sim/simulation';
import { createNewGame, isGameState, sanitizeState } from './sim/state';
import { createGame } from './view/game';

async function boot(): Promise<void> {
  const gameEl = requireElement('game');
  const uiEl = requireElement('ui');

  const platform = await createPlatform();
  platform.loadingStart();

  const grid = parseGrid(YARD);
  const saves = new SaveManager(platform.storage, isGameState);
  const loaded = saves.load();
  if (loaded?.fromBackup) console.warn('Main save was unreadable; restored the backup');
  const state = loaded ? sanitizeState(loaded.state, grid) : createNewGame(grid);

  const sim = new Simulation(state, grid);
  const autosave = new AutoSaver(saves, sim);
  autosave.start();

  // Clicking the game focuses its iframe, so the keyboard works on the portal page.
  gameEl.addEventListener('pointerdown', () => window.focus());
  const input = new InputManager(window, gameEl, uiEl);

  const ctx: GameContext = { platform, sim, input };
  const game = createGame(gameEl, ctx);
  new DebugOverlay(uiEl, game, ctx);

  if (import.meta.env.DEV) Object.assign(window, { scrap: { ...ctx, saves, autosave, game } });
}

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id}`);
  return el;
}

boot().catch((err: unknown) => {
  console.error(err);
  document.getElementById('loader')?.remove();
  const message = document.createElement('p');
  message.className = 'boot-error';
  message.textContent = t('boot.error');
  document.getElementById('ui')?.append(message);
});
