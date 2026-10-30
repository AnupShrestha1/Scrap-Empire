import Phaser from 'phaser';
import { VIEW } from '../../config';
import type { GameContext } from '../../context';
import type { SimEvent } from '../../sim/events';
import type { Facing } from '../../sim/state';
import type { Vec2 } from '../../sim/vec';
import { FEET_Y, PLAYER_SIZE } from '../art/player';
import { bakeGround } from '../ground';
import { depthAt, isoProjection, screenDirToGrid, toScreen, type IsoProjection } from '../iso';
import { FRAME, SCENE, TEX } from '../keys';
import { placeDecor } from '../world/decor';
import { Labels } from '../world/labels';
import { placePads } from '../world/pads';
import { CarriedStackView, createStationViews, type StationViews } from '../world/stationViews';

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
  private labels!: Labels;
  private stations!: StationViews;
  private carried!: CarriedStackView;
  private readonly simEvents: SimEvent[] = [];
  /** Cash earned per station this frame, shown as one floating "+$" each. */
  private readonly sales = new Map<string, number>();
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
    const { grid, stations } = this.ctx.sim;
    this.proj = isoProjection(grid.width, grid.height);

    bakeGround(this.textures, TEX.ground, grid, this.proj);
    this.add.image(0, 0, TEX.ground).setOrigin(0).setDepth(-1);
    placeDecor(this, this.proj, grid);

    this.labels = new Labels(this);
    placePads(this, this.proj, this.labels, stations);
    this.stations = createStationViews(this, this.proj, this.labels, stations);
    this.player = this.add.image(0, 0, TEX.atlas, FRAME.playerFront).setOrigin(0.5, FEET_Y / PLAYER_SIZE.h);
    this.carried = new CarriedStackView(this, this.labels);

    const camera = this.cameras.main;
    camera.setBounds(0, 0, this.proj.width, this.proj.height);
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    this.render(0, 0);
    this.cameraX = this.player.x;
    this.cameraY = this.player.y;
    camera.centerOn(this.cameraX, this.cameraY);

    this.lastFrameAt = performance.now();
    document.getElementById('loader')?.remove();
    this.ctx.platform.loadingStop();
    this.ctx.platform.gameplayStart();
  }

  override update(time: number): void {
    const now = performance.now();
    const elapsed = now - this.lastFrameAt;
    this.lastFrameAt = now;

    const { sim, input } = this.ctx;
    input.readMove(this.screenMove);
    screenDirToGrid(this.screenMove.x, this.screenMove.y, this.gridMove);
    sim.setMoveInput(this.gridMove.x, this.gridMove.y);
    sim.advance(elapsed);

    this.sales.clear();
    for (const event of sim.drainEvents(this.simEvents)) {
      if (event.type === 'storageFull') this.stations.bins.get(event.station)?.flash(time);
      if (event.type === 'sold') this.sales.set(event.station, (this.sales.get(event.station) ?? 0) + event.value);
    }
    for (const [station, value] of this.sales) this.showSale(station, value);
    this.ctx.hud.update(sim.state);
    this.render(elapsed, time);
    this.followPlayer(elapsed);
  }

  private render(elapsedMs: number, timeMs: number): void {
    const { sim } = this.ctx;
    const { state, prevPlayer, alpha } = sim;
    const p = state.player;
    const gx = prevPlayer.x + (p.x - prevPlayer.x) * alpha;
    const gy = prevPlayer.y + (p.y - prevPlayer.y) * alpha;
    const at = toScreen(this.proj, gx, gy, this.point);

    const walking = p.x !== prevPlayer.x || p.y !== prevPlayer.y;
    this.walkTime = walking ? this.walkTime + elapsedMs / 1000 : 0;
    const bob = Math.abs(Math.sin(this.walkTime * BOB.rate * Math.PI)) * BOB.height;
    const depth = depthAt(gx, gy);
    const look = FACING_FRAME[p.facing];
    this.player.setFrame(look.frame).setFlipX(look.flip).setPosition(at.x, at.y - bob).setDepth(depth);
    this.carried.update(sim, at.x, at.y - bob, depth);

    for (const view of this.stations.views) view.update(sim, timeMs);
  }

  private showSale(station: string, value: number): void {
    const def = this.ctx.sim.stations.find((s) => s.id === station);
    if (!def) return;
    const sell = def.kind === 'bin' ? def.zones.sell : def.rect;
    const at = toScreen(this.proj, sell.x + sell.w / 2, sell.y + sell.h / 2);
    this.labels.floating(`+$${value}`, at.x, at.y - 50);
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
    this.labels?.refit();
  }
}
