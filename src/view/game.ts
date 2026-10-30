import Phaser from 'phaser';
import { VIEW } from '../config';
import type { GameContext } from '../context';
import { PALETTE } from './art/palette';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';

/** Canvas size in device pixels (DPR capped). CSS stretches the canvas back over its parent. */
function canvasSize(parent: HTMLElement): { width: number; height: number } {
  const dpr = Math.min(window.devicePixelRatio || 1, VIEW.maxDpr);
  return {
    width: Math.max(1, Math.round(parent.clientWidth * dpr)),
    height: Math.max(1, Math.round(parent.clientHeight * dpr)),
  };
}

export function createGame(parent: HTMLElement, ctx: GameContext): Phaser.Game {
  const { width, height } = canvasSize(parent);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: PALETTE.background,
    // We size the canvas ourselves (see canvasSize) to render sharply on high-DPI phones.
    scale: { mode: Phaser.Scale.NONE },
    // Pixel art: nearest-neighbour texture filtering and whole-pixel sprite positions.
    pixelArt: true,
    banner: false,
    // Input comes from our own keyboard and joystick handlers; audio arrives in M1.
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    audio: { noAudio: true },
    scene: [new BootScene(), new WorldScene(ctx)],
  });

  window.addEventListener('resize', () => {
    const size = canvasSize(parent);
    game.scale.resize(size.width, size.height);
  });
  parent.addEventListener('contextmenu', (e) => e.preventDefault());
  return game;
}
