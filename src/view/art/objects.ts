// Upright yard objects for the isometric view. Coordinates are art pixels; a tile is a 32×16 diamond.
import { PALETTE as C } from './palette';
import { pixelArt, type Pixels } from './pixel';

/** Frame sizes in render pixels, and the anchor (0..1 of the frame) that sits on the ground point. */
export const OBJECT_SIZE = {
  /** Anchored at the tile's south (bottom) corner. */
  crate: { w: 64, h: 64, originY: 30 / 32 },
  /** Anchored at the tile centre. */
  fencePost: { w: 16, h: 40, originY: 18 / 20 },
  /** Anchored at the tile centre; each runs half a tile towards one neighbour. */
  fenceRun: { w: 64, h: 56, originY: 22 / 28 },
} as const;

const CRATE_HEIGHT = 14;

/** A wooden crate filling its tile: diamond lid, lit left face, shaded right face. */
export const drawCrate = pixelArt((p) => {
  const cx = p.w / 2;
  // Side faces: each column runs down from the lid's lower edge.
  for (let x = 0; x < p.w; x++) {
    const edge = 8 + Math.floor((x < cx ? x : p.w - 1 - x) / 2);
    const left = x < cx;
    p.rect(x, edge, 1, CRATE_HEIGHT, left ? C.wood : C.woodDark);
    if (x % 5 === 2) p.rect(x, edge + 1, 1, CRATE_HEIGHT - 2, left ? C.woodDark : C.outline);
  }
  // Lid: the tile diamond, with plank gaps.
  for (let row = 0; row < 16; row++) {
    const hw = row < 8 ? (row + 1) * 2 : (16 - row) * 2;
    p.rect(cx - hw, row, hw * 2, 1, row % 4 === 3 ? C.wood : C.woodLight);
  }
});

export const drawFencePost = pixelArt((p) => {
  p.rect(3, 2, 2, 16, C.fencePost);
  p.px(3, 2, C.fencePostLight);
});

/** Grid direction a fence run heads in from its tile centre. */
export type FenceDir = '+x' | '-x' | '+y' | '-y';

/** Half a tile in art pixels along each grid direction: +x is down-right, +y is down-left. */
const HALF_STEP: Readonly<Record<FenceDir, readonly [number, number]>> = {
  '+x': [8, 4],
  '-x': [-8, -4],
  '+y': [-8, 4],
  '-y': [8, -4],
};

/** Rails and chain-link mesh from the frame's anchor half a tile towards `dir`. */
function fenceRun(p: Pixels, dir: FenceDir): void {
  const ax = p.w / 2;
  const ay = 22;
  const [dx, dy] = HALF_STEP[dir];
  const steps = Math.abs(dx);
  for (let i = 0; i <= steps; i++) {
    const x = ax + Math.sign(dx) * i;
    const ground = ay + Math.round((dy * i) / steps);
    for (let h = 4; h < 12; h++) {
      if ((i + h) % 4 === 0 || (i - h + 64) % 4 === 0) p.px(x, ground - h, C.fenceMesh);
    }
    p.px(x, ground - 3, C.fenceMesh);
    p.px(x, ground - 12, C.fenceMesh);
    p.px(x, ground - 13, C.fencePost);
  }
}

function fenceRunDraw(dir: FenceDir) {
  return pixelArt((p) => fenceRun(p, dir), { outline: false });
}

export const FENCE_RUNS: Readonly<Record<FenceDir, ReturnType<typeof fenceRunDraw>>> = {
  '+x': fenceRunDraw('+x'),
  '-x': fenceRunDraw('-x'),
  '+y': fenceRunDraw('+y'),
  '-y': fenceRunDraw('-y'),
};
