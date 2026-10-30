import './ui/styles.css';
import type { GameContext } from './context';
import { STATIONS, TRUCK_ROUTE, YARD } from './data/layout';
import { DebugOverlay } from './debug/overlay';
import { t } from './i18n';
import { InputManager } from './input';
import { createPlatform } from './platform';
import { AutoSaver } from './save/autosave';
import { SAVE_KEYS, SaveManager } from './save/saveManager';
import { parseGrid } from './sim/grid';
import { Simulation } from './sim/simulation';
import { createNewGame, isGameState, sanitizeState } from './sim/state';
import { Sfx } from './audio/sfx';
import { SettingsStore } from './settings';
import { Hud } from './ui/hud';
import { Toasts } from './ui/toasts';
import { createGame } from './view/game';

async function boot(): Promise<void> {
  const gameEl = requireElement('game');
  const uiEl = requireElement('ui');

  const platform = await createPlatform();
  platform.loadingStart();

  const grid = parseGrid(YARD, STATIONS);
  const saves = new SaveManager(platform.storage, isGameState);
  const loaded = saves.load();
  if (loaded?.fromBackup) console.warn('Main save was unreadable; restored the backup');
  const state = loaded ? sanitizeState(loaded.state, grid, STATIONS) : createNewGame(grid, STATIONS);

  const sim = new Simulation(state, grid, STATIONS, TRUCK_ROUTE.pile);
  const autosave = new AutoSaver(saves, sim);
  autosave.start();

  // Clicking the game focuses its iframe, so the keyboard works on the portal page.
  gameEl.addEventListener('pointerdown', () => window.focus());
  const input = new InputManager(window, gameEl, uiEl);

  const settings = new SettingsStore(platform.storage);
  const sfx = new Sfx(() => !settings.value.sound || platform.audioMuted());
  const ctx: GameContext = { platform, sim, input, settings, sfx, hud: new Hud(uiEl, settings), toasts: new Toasts(uiEl) };
  const game = createGame(gameEl, ctx);
  new DebugOverlay(uiEl, game, ctx, {
    resetSave: () => {
      autosave.stop();
      for (const key of Object.values(SAVE_KEYS)) platform.storage.removeItem(key);
      location.reload();
    },
  });

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
