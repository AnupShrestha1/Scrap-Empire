import '@fontsource/lilita-one/latin-400.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/nunito/latin-900.css';
import './ui/styles.css';
import { Vector2 } from 'three';
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
import { loadModels } from './view/assets';
import { World } from './view/world';

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

  const sim = new Simulation(state, grid, STATIONS, TRUCK_ROUTE.dump);
  const autosave = new AutoSaver(saves, sim);
  autosave.start();

  // Q drops everything carried, like the on-screen Drop button.
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyQ' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) sim.requestDrop();
  });

  // Clicking the game focuses its iframe, so the keyboard works on the portal page.
  gameEl.addEventListener('pointerdown', () => window.focus());
  const input = new InputManager(window, gameEl, uiEl);

  const settings = new SettingsStore(platform.storage);
  const sfx = new Sfx(() => !settings.value.sound || platform.audioMuted());
  const ctx: GameContext = { platform, sim, input, settings, sfx, hud: new Hud(uiEl, settings, () => sim.requestDrop()), toasts: new Toasts(uiEl) };

  const bar = document.querySelector<HTMLElement>('.loader-bar');
  const models = await loadModels((done) => bar?.style.setProperty('width', `${Math.round(done * 100)}%`));
  const world = new World(gameEl, ctx, models, uiEl);
  document.getElementById('loader')?.remove();
  platform.loadingStop();
  world.start();
  platform.gameplayStart();

  const fps = fpsCounter();
  new DebugOverlay(uiEl, ctx, {
    viewLines: () => {
      const { calls, triangles } = world.renderer.info.render;
      const size = world.renderer.getDrawingBufferSize(new Vector2());
      return [`fps     ${fps()}`, `draws   ${calls}  tris ${Math.round(triangles / 1000)}k`, `canvas  ${size.x}×${size.y}`];
    },
    resetSave: () => {
      autosave.stop();
      for (const key of Object.values(SAVE_KEYS)) platform.storage.removeItem(key);
      location.reload();
    },
  });

  if (import.meta.env.DEV) Object.assign(window, { scrap: { ...ctx, saves, autosave, world } });
}

/** Frames per second, counted over the last second. */
function fpsCounter(): () => number {
  let frames = 0;
  let fps = 0;
  let since = performance.now();
  const tick = () => {
    frames++;
    const now = performance.now();
    if (now - since >= 1000) {
      fps = Math.round((frames * 1000) / (now - since));
      frames = 0;
      since = now;
    }
    requestAnimationFrame(tick);
  };
  tick();
  return () => fps;
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
