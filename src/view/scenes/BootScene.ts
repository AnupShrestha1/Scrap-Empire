import Phaser from 'phaser';
import { drawCrate, drawFencePost, FENCE_RUNS, OBJECT_SIZE, type FenceDir } from '../art/objects';
import { drawPlayerBack, drawPlayerFront, PLAYER_SIZE } from '../art/player';
import { AtlasBuilder } from '../art/textures';
import { FRAME, SCENE, TEX } from '../keys';

/** Draws all sprite art in code at startup; nothing is downloaded. The ground is baked by WorldScene. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.boot);
  }

  create(): void {
    const atlas = new AtlasBuilder(512);
    atlas.add(FRAME.playerFront, PLAYER_SIZE.w, PLAYER_SIZE.h, drawPlayerFront);
    atlas.add(FRAME.playerBack, PLAYER_SIZE.w, PLAYER_SIZE.h, drawPlayerBack);
    atlas.add(FRAME.crate, OBJECT_SIZE.crate.w, OBJECT_SIZE.crate.h, drawCrate);
    atlas.add(FRAME.fencePost, OBJECT_SIZE.fencePost.w, OBJECT_SIZE.fencePost.h, drawFencePost);
    for (const [dir, draw] of Object.entries(FENCE_RUNS) as [FenceDir, (typeof FENCE_RUNS)[FenceDir]][]) {
      atlas.add(FRAME.fenceRun(dir), OBJECT_SIZE.fenceRun.w, OBJECT_SIZE.fenceRun.h, draw);
    }
    atlas.commit(this.textures, TEX.atlas);

    this.scene.start(SCENE.world);
  }
}
