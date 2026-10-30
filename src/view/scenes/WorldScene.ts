import Phaser from 'phaser';
import { VIEW } from '../../config';
import type { GameContext } from '../../context';
import { Tile, tileAt, type Grid } from '../../sim/grid';
import type { Facing } from '../../sim/state';
import type { Vec2 } from '../../sim/vec';
import { FEET_Y, PLAYER_SIZE } from '../art/player';
import { tilesetIndex } from '../art/tiles';
import { FRAME, SCENE, TEX } from '../keys';

/** Frame and mirroring per facing; the side frame faces left. */
const FACING_FRAME: Readonly<Record<Facing, { frame: string; flip: boolean }>> = {
  down: { frame: FRAME.playerDown, flip: false },
  up: { frame: FRAME.playerUp, flip: false },
  left: { frame: FRAME.playerSide, flip: false },
  right: { frame: FRAME.playerSide, flip: true },
};

/** Walking bob: height in render pixels and cycles per second. */
const BOB = { height: 3, rate: 3.2 } as const;

/** Fraction of the remaining distance to cover this frame, so smoothing is the same at any frame rate. */
function smoothing(ratePerSecond: number, elapsedMs: number): number {
  return 1 - Math.exp((-ratePerSecond * elapsedMs) / 1000);
}

function groundRows(grid: Grid): number[][] {
  const rows: number[][] = [];
  for (let y = 0; y < grid.height; y++) {
    const row: number[] = [];
    for (let x = 0; x < grid.width; x++) row.push(tilesetIndex(tileAt(grid, x, y), x, y));
    rows.push(row);
  }
  return rows;
}

/**
 * Draws the yard in a ¾ view from simulation state and feeds input into the simulation each frame.
 * Upright things are depth-sorted by the y of their base, so the worker passes behind crates and fences.
 */
export class WorldScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Image;
  private readonly move: Vec2 = { x: 0, y: 0 };
  private lastFrameAt = 0;
  private walkTime = 0;
  private cameraX = 0;
  private cameraY = 0;

  constructor(private readonly ctx: GameContext) {
    super(SCENE.world);
  }

  create(): void {
    const { grid } = this.ctx.sim;
    const T = VIEW.tilePx;

    const map = this.make.tilemap({ data: groundRows(grid), tileWidth: T, tileHeight: T });
    const tileset = map.addTilesetImage(TEX.ground, TEX.ground, T, T, 1, 2);
    if (!tileset) throw new Error('Ground tileset is missing');
    map.createLayer(0, tileset, 0, 0)?.setDepth(-1);
    this.placeObjects(grid);

    this.player = this.add.image(0, 0, TEX.atlas, FRAME.playerDown).setOrigin(0.5, FEET_Y / PLAYER_SIZE.h);
    this.syncPlayer(0);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, grid.width * T, grid.height * T);
    this.cameraX = this.player.x;
    this.cameraY = this.player.y;
    camera.centerOn(this.cameraX, this.cameraY);
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);

    this.lastFrameAt = performance.now();
    document.getElementById('loader')?.remove();
    this.ctx.platform.loadingStop();
    this.ctx.platform.gameplayStart();
  }

  override update(): void {
    const now = performance.now();
    const elapsed = now - this.lastFrameAt;
    this.lastFrameAt = now;

    const { sim, input } = this.ctx;
    input.readMove(this.move);
    sim.setMoveInput(this.move.x, this.move.y);
    sim.advance(elapsed);

    this.syncPlayer(elapsed);
    this.followPlayer(elapsed);
  }

  /** One upright sprite per fence or crate tile, standing on the bottom edge of its tile. */
  private placeObjects(grid: Grid): void {
    const T = VIEW.tilePx;
    const isFence = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < grid.width && y < grid.height && tileAt(grid, x, y) === Tile.Fence;

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = tileAt(grid, x, y);
        let frame: string;
        if (tile === Tile.Crate) frame = FRAME.crate;
        else if (tile === Tile.Fence) {
          const runsAcross = isFence(x - 1, y) || isFence(x + 1, y);
          const runsDown = isFence(x, y - 1) || isFence(x, y + 1);
          frame = runsDown && !runsAcross ? FRAME.fenceV : FRAME.fenceH;
        } else continue;
        this.add.image((x + 0.5) * T, (y + 1) * T, TEX.atlas, frame).setOrigin(0.5, 1).setDepth((y + 1) * T);
      }
    }
  }

  /** Places the sprite between the last two ticks, picks its facing frame and bobs it while walking. */
  private syncPlayer(elapsedMs: number): void {
    const { state, prevPlayer, alpha } = this.ctx.sim;
    const p = state.player;
    const T = VIEW.tilePx;
    const x = (prevPlayer.x + (p.x - prevPlayer.x) * alpha) * T;
    const y = (prevPlayer.y + (p.y - prevPlayer.y) * alpha) * T;

    const walking = p.x !== prevPlayer.x || p.y !== prevPlayer.y;
    this.walkTime = walking ? this.walkTime + elapsedMs / 1000 : 0;
    const bob = Math.abs(Math.sin(this.walkTime * BOB.rate * Math.PI)) * BOB.height;

    const look = FACING_FRAME[p.facing];
    this.player.setFrame(look.frame).setFlipX(look.flip).setPosition(x, y - bob).setDepth(y);
  }

  private followPlayer(elapsedMs: number): void {
    const k = smoothing(VIEW.cameraFollowRate, elapsedMs);
    this.cameraX += (this.player.x - this.cameraX) * k;
    this.cameraY += (this.player.y - this.cameraY) * k;
    this.cameras.main.centerOn(this.cameraX, this.cameraY);
  }

  /** Zooms so at least VIEW.minVisibleTiles are on screen, whatever the canvas size. */
  private fitCamera(): void {
    const { width, height } = this.scale;
    const T = VIEW.tilePx;
    const { w, h } = VIEW.minVisibleTiles;
    this.cameras.main.setZoom(Math.min(width / (w * T), height / (h * T)));
  }
}
