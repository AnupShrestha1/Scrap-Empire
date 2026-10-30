import Phaser from 'phaser';
import { VIEW } from '../../config';
import type { GameContext } from '../../context';
import { Tile, tileAt, type Grid } from '../../sim/grid';
import type { Facing } from '../../sim/state';
import type { Vec2 } from '../../sim/vec';
import { OBJECT_SIZE, type FenceDir } from '../art/objects';
import { FEET_Y, PLAYER_SIZE } from '../art/player';
import { bakeGround } from '../ground';
import { depthAt, isoProjection, screenDirToGrid, toScreen, type IsoProjection } from '../iso';
import { FRAME, SCENE, TEX } from '../keys';

/**
 * Frame and mirroring per facing. On screen, grid +x runs down-right and +y down-left;
 * the front pose faces down-left and the back pose up-right.
 */
const FACING_FRAME: Readonly<Record<Facing, { frame: string; flip: boolean }>> = {
  down: { frame: FRAME.playerFront, flip: false },
  right: { frame: FRAME.playerFront, flip: true },
  up: { frame: FRAME.playerBack, flip: false },
  left: { frame: FRAME.playerBack, flip: true },
};

/** Grid offset to the neighbour in each fence direction. */
const FENCE_NEIGHBOUR: Readonly<Record<FenceDir, readonly [number, number]>> = {
  '+x': [1, 0],
  '-x': [-1, 0],
  '+y': [0, 1],
  '-y': [0, -1],
};

/** Walking bob: height in render pixels and cycles per second. */
const BOB = { height: 3, rate: 3.2 } as const;

/** Fraction of the remaining distance to cover this frame, so smoothing is the same at any frame rate. */
function smoothing(ratePerSecond: number, elapsedMs: number): number {
  return 1 - Math.exp((-ratePerSecond * elapsedMs) / 1000);
}

/**
 * Draws the yard isometrically from simulation state and feeds input into the simulation each frame.
 * Upright things are depth-sorted by how far down the screen they stand.
 */
export class WorldScene extends Phaser.Scene {
  private proj!: IsoProjection;
  private player!: Phaser.GameObjects.Image;
  private readonly screenMove: Vec2 = { x: 0, y: 0 };
  private readonly gridMove: Vec2 = { x: 0, y: 0 };
  private readonly point: Vec2 = { x: 0, y: 0 };
  private lastFrameAt = 0;
  private walkTime = 0;
  private cameraX = 0;
  private cameraY = 0;

  constructor(private readonly ctx: GameContext) {
    super(SCENE.world);
  }

  create(): void {
    const { grid } = this.ctx.sim;
    this.proj = isoProjection(grid.width, grid.height);

    bakeGround(this.textures, TEX.ground, grid, this.proj);
    this.add.image(0, 0, TEX.ground).setOrigin(0).setDepth(-1);
    this.placeObjects(grid);

    this.player = this.add.image(0, 0, TEX.atlas, FRAME.playerFront).setOrigin(0.5, FEET_Y / PLAYER_SIZE.h);
    this.syncPlayer(0);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.proj.width, this.proj.height);
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
    input.readMove(this.screenMove);
    screenDirToGrid(this.screenMove.x, this.screenMove.y, this.gridMove);
    sim.setMoveInput(this.gridMove.x, this.gridMove.y);
    sim.advance(elapsed);

    this.syncPlayer(elapsed);
    this.followPlayer(elapsed);
  }

  /** Crates, and fences built from a post per tile plus half-runs towards each fenced neighbour. */
  private placeObjects(grid: Grid): void {
    const isFence = (x: number, y: number) =>
      x >= 0 && y >= 0 && x < grid.width && y < grid.height && tileAt(grid, x, y) === Tile.Fence;

    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const tile = tileAt(grid, x, y);
        if (tile === Tile.Crate) {
          this.addObject(FRAME.crate, x + 1, y + 1, OBJECT_SIZE.crate.originY, depthAt(x + 0.5, y + 0.5));
        } else if (tile === Tile.Fence) {
          const cx = x + 0.5;
          const cy = y + 0.5;
          this.addObject(FRAME.fencePost, cx, cy, OBJECT_SIZE.fencePost.originY, depthAt(cx, cy));
          for (const [dir, [dx, dy]] of Object.entries(FENCE_NEIGHBOUR) as [FenceDir, readonly [number, number]][]) {
            if (!isFence(x + dx, y + dy)) continue;
            const depth = depthAt(cx + dx * 0.25, cy + dy * 0.25);
            this.addObject(FRAME.fenceRun(dir), cx, cy, OBJECT_SIZE.fenceRun.originY, depth);
          }
        }
      }
    }
  }

  /** Places an atlas frame so its anchor sits on grid point (gx, gy). */
  private addObject(frame: string, gx: number, gy: number, originY: number, depth: number): void {
    const at = toScreen(this.proj, gx, gy, this.point);
    this.add.image(at.x, at.y, TEX.atlas, frame).setOrigin(0.5, originY).setDepth(depth);
  }

  /** Places the sprite between the last two ticks, picks its facing frame and bobs it while walking. */
  private syncPlayer(elapsedMs: number): void {
    const { state, prevPlayer, alpha } = this.ctx.sim;
    const p = state.player;
    const gx = prevPlayer.x + (p.x - prevPlayer.x) * alpha;
    const gy = prevPlayer.y + (p.y - prevPlayer.y) * alpha;
    const at = toScreen(this.proj, gx, gy, this.point);

    const walking = p.x !== prevPlayer.x || p.y !== prevPlayer.y;
    this.walkTime = walking ? this.walkTime + elapsedMs / 1000 : 0;
    const bob = Math.abs(Math.sin(this.walkTime * BOB.rate * Math.PI)) * BOB.height;

    const look = FACING_FRAME[p.facing];
    this.player.setFrame(look.frame).setFlipX(look.flip).setPosition(at.x, at.y - bob).setDepth(depthAt(gx, gy));
  }

  private followPlayer(elapsedMs: number): void {
    const k = smoothing(VIEW.cameraFollowRate, elapsedMs);
    this.cameraX += (this.player.x - this.cameraX) * k;
    this.cameraY += (this.player.y - this.cameraY) * k;
    this.cameras.main.centerOn(this.cameraX, this.cameraY);
  }

  /** Zooms so at least VIEW.minVisiblePx of the world is on screen, whatever the canvas size. */
  private fitCamera(): void {
    const { width, height } = this.scale;
    const { w, h } = VIEW.minVisiblePx;
    this.cameras.main.setZoom(Math.min(width / w, height / h));
  }
}
