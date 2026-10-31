import Phaser from 'phaser';
import { ITEM_IDS } from '../../data/items';
import { STATIONS } from '../../data/layout';
import { padsFor } from '../world/pads';
import { BOOTH_FRAME, drawBooth, drawLampPost, drawTree, LAMP_POST_FRAME, TREE_FRAME, TREE_VARIANTS } from '../art/nature';
import { drawCrate, drawFencePost, FENCE_RUNS, OBJECT_SIZE, type FenceDir } from '../art/objects';
import { drawPlayerBack, drawPlayerFront, PLAYER_SIZE } from '../art/player';
import {
  BIN_FRAME,
  BIN_LEVELS,
  drawBin,
  drawItem,
  drawPad,
  padFrame,
  ARROW_FRAME,
  drawArrow,
  drawLamp,
  drawPile,
  drawShredder,
  drawTruck,
  ITEM_FRAME,
  LAMP_FRAME,
  PILE_FRAME,
  PILE_STAGES,
  SHREDDER_FRAME,
  TRUCK_FRAME,
} from '../art/stations';
import { AtlasBuilder } from '../art/textures';
import { CHUTE_FRAME, drawChute, drawFactory, FACTORY_FRAME } from '../art/factory';
import { FRAME, SCENE, TEX } from '../keys';

const STATUSES = ['idle', 'processing', 'ready', 'blocked'] as const;

/** Draws all sprite art in code at startup; nothing is downloaded. The ground is baked by WorldScene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.boot);
  }

  create(): void {
    const atlas = new AtlasBuilder(2048, 1024);
    atlas.add(FRAME.playerFront, PLAYER_SIZE.w, PLAYER_SIZE.h, drawPlayerFront);
    atlas.add(FRAME.playerBack, PLAYER_SIZE.w, PLAYER_SIZE.h, drawPlayerBack);
    atlas.add(FRAME.crate, OBJECT_SIZE.crate.w, OBJECT_SIZE.crate.h, drawCrate);
    atlas.add(FRAME.fencePost, OBJECT_SIZE.fencePost.w, OBJECT_SIZE.fencePost.h, drawFencePost);
    for (const [dir, draw] of Object.entries(FENCE_RUNS) as [FenceDir, (typeof FENCE_RUNS)[FenceDir]][]) {
      atlas.add(FRAME.fenceRun(dir), OBJECT_SIZE.fenceRun.w, OBJECT_SIZE.fenceRun.h, draw);
    }
    for (let v = 0; v < TREE_VARIANTS; v++) atlas.add(FRAME.tree(v), TREE_FRAME.w, TREE_FRAME.h, drawTree(v));
    atlas.add(FRAME.lampPost, LAMP_POST_FRAME.w, LAMP_POST_FRAME.h, drawLampPost);
    atlas.add(FRAME.booth, BOOTH_FRAME.w, BOOTH_FRAME.h, drawBooth);
    for (let s = 0; s < PILE_STAGES; s++) atlas.add(FRAME.pile(s), PILE_FRAME.w, PILE_FRAME.h, drawPile(s));
    for (let f = 0; f < 2; f++) atlas.add(FRAME.shredder(f), SHREDDER_FRAME.w, SHREDDER_FRAME.h, drawShredder(f));
    for (const s of STATUSES) atlas.add(FRAME.lamp(s), LAMP_FRAME.w, LAMP_FRAME.h, drawLamp(s));
    for (const item of ['iron', 'aluminium'] as const) {
      for (let l = 0; l < BIN_LEVELS; l++) atlas.add(FRAME.bin(item, l), BIN_FRAME.w, BIN_FRAME.h, drawBin(item, l));
    }
    atlas.add(FRAME.truck(false), TRUCK_FRAME.w, TRUCK_FRAME.h, drawTruck(false));
    atlas.add(FRAME.truck(true), TRUCK_FRAME.w, TRUCK_FRAME.h, drawTruck(true));
    for (const item of ITEM_IDS) atlas.add(FRAME.item(item), ITEM_FRAME.w, ITEM_FRAME.h, drawItem(item));
    for (const pad of padsFor(STATIONS)) {
      const size = padFrame(pad.rect.w, pad.rect.h);
      atlas.add(FRAME.pad(pad.station, pad.zone), size.w, size.h, drawPad(pad.rect.w, pad.rect.h, pad.kind));
    }
    atlas.add(FRAME.arrow, ARROW_FRAME.w, ARROW_FRAME.h, drawArrow);
    atlas.add(FRAME.factory, FACTORY_FRAME.w, FACTORY_FRAME.h, drawFactory);
    atlas.add(FRAME.chute, CHUTE_FRAME.w, CHUTE_FRAME.h, drawChute);
    atlas.commit(this.textures, TEX.atlas);

    this.scene.start(SCENE.world);
  }
}
