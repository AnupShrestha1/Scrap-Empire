import type Phaser from 'phaser';
import { Tile, tileAt, type Grid } from '../../sim/grid';
import type { Vec2 } from '../../sim/vec';
import { BOOTH_FRAME, LAMP_POST_FRAME, TREE_FRAME, TREE_VARIANTS } from '../art/nature';
import { OBJECT_SIZE, type FenceDir } from '../art/objects';
import { depthAt, toScreen, type IsoProjection } from '../iso';
import { FRAME, TEX } from '../keys';

/** Grid offset to the neighbour in each fence direction. */
const FENCE_NEIGHBOUR: Readonly<Record<FenceDir, readonly [number, number]>> = {
  '+x': [1, 0],
  '-x': [-1, 0],
  '+y': [0, 1],
  '-y': [0, -1],
};

/** Places an atlas frame with its origin on grid point (gx, gy). */
export function placeFrame(
  scene: Phaser.Scene,
  proj: IsoProjection,
  frame: string,
  gx: number,
  gy: number,
  origin: { originX?: number; originY: number },
  depth: number,
): Phaser.GameObjects.Image {
  const at: Vec2 = toScreen(proj, gx, gy);
  return scene.add
    .image(at.x, at.y, TEX.atlas, frame)
    .setOrigin(origin.originX ?? 0.5, origin.originY)
    .setDepth(depth);
}

/** Static upright objects from the layout: fences, crates, trees, lamp posts and the booth. */
export function placeDecor(scene: Phaser.Scene, proj: IsoProjection, grid: Grid): void {
  const isFence = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < grid.width && y < grid.height && tileAt(grid, x, y) === Tile.Fence;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const tile = tileAt(grid, x, y);
      const centre = depthAt(x + 0.5, y + 0.5);
      switch (tile) {
        case Tile.Crate:
          placeFrame(scene, proj, FRAME.crate, x + 1, y + 1, OBJECT_SIZE.crate, centre);
          break;
        case Tile.Tree: {
          const variant = ((x * 7 + y * 13) >>> 0) % TREE_VARIANTS;
          placeFrame(scene, proj, FRAME.tree(variant), x + 1, y + 1, TREE_FRAME, centre);
          break;
        }
        case Tile.Lamp:
          placeFrame(scene, proj, FRAME.lampPost, x + 1, y + 1, LAMP_POST_FRAME, centre);
          break;
        case Tile.Booth:
          placeFrame(scene, proj, FRAME.booth, x + 1, y + 1, BOOTH_FRAME, centre);
          break;
        case Tile.Fence: {
          const cx = x + 0.5;
          const cy = y + 0.5;
          placeFrame(scene, proj, FRAME.fencePost, cx, cy, OBJECT_SIZE.fencePost, centre);
          for (const [dir, [dx, dy]] of Object.entries(FENCE_NEIGHBOUR) as [FenceDir, readonly [number, number]][]) {
            if (!isFence(x + dx, y + dy)) continue;
            placeFrame(scene, proj, FRAME.fenceRun(dir), cx, cy, OBJECT_SIZE.fenceRun, depthAt(cx + dx * 0.25, cy + dy * 0.25));
          }
          break;
        }
        default:
          break;
      }
    }
  }
}
