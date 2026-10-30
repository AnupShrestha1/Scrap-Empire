import Phaser from 'phaser';
import { VIEW } from '../../config';
import { drawCrate, drawFenceH, drawFenceV, OBJECT_SIZE } from '../art/objects';
import { drawPlayerDown, drawPlayerSide, drawPlayerUp, PLAYER_SIZE } from '../art/player';
import { AtlasBuilder, buildTileset } from '../art/textures';
import { TILESET } from '../art/tiles';
import { FRAME, SCENE, TEX } from '../keys';

/** Draws all art in code at startup; nothing is downloaded. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.boot);
  }

  create(): void {
    buildTileset(this.textures, TEX.ground, VIEW.tilePx, TILESET);

    const atlas = new AtlasBuilder(256);
    const { w: pw, h: ph } = PLAYER_SIZE;
    atlas.add(FRAME.playerDown, pw, ph, drawPlayerDown);
    atlas.add(FRAME.playerUp, pw, ph, drawPlayerUp);
    atlas.add(FRAME.playerSide, pw, ph, drawPlayerSide);
    atlas.add(FRAME.crate, OBJECT_SIZE.crate.w, OBJECT_SIZE.crate.h, drawCrate);
    atlas.add(FRAME.fenceH, OBJECT_SIZE.fence.w, OBJECT_SIZE.fence.h, drawFenceH);
    atlas.add(FRAME.fenceV, OBJECT_SIZE.fence.w, OBJECT_SIZE.fence.h, drawFenceV);
    atlas.commit(this.textures, TEX.atlas);

    this.scene.start(SCENE.world);
  }
}
