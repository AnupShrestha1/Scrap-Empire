// Upright yard objects for the ¾ view. Each frame's bottom edge sits on the bottom of its tile,
// and the art rises above the tile so things behind it are hidden. Coordinates are art pixels.
import { PALETTE as C } from './palette';
import { pixelArt, type Pixels } from './pixel';

/** Frame sizes in render pixels. */
export const OBJECT_SIZE = {
  crate: { w: 64, h: 88 },
  fence: { w: 64, h: 72 },
} as const;

export const drawCrate = pixelArt((p) => {
  const x = 3;
  const w = p.w - 6;
  const top = 12;
  const front = 31;
  const bottom = p.h - 2;

  p.rect(x + 2, bottom, w, 2, C.shadow);
  // Lid, with plank gaps.
  p.rect(x, top, w, front - top, C.woodLight);
  for (let y = top + 4; y < front - 1; y += 5) p.rect(x, y, w, 1, C.wood);
  // Front face, darker, with a frame and a diagonal brace.
  p.rect(x, front, w, bottom - front, C.wood);
  p.rect(x, front, w, 1, C.woodDark);
  p.rect(x + 1, front + 1, 2, bottom - front - 1, C.woodDark);
  p.rect(x + w - 3, front + 1, 2, bottom - front - 1, C.woodDark);
  p.rect(x + 1, bottom - 2, w - 2, 2, C.woodDark);
  for (let i = 0; i < w - 6; i++) {
    const y = front + 1 + Math.floor((i * (bottom - front - 3)) / (w - 6));
    p.rect(x + 3 + i, y, 1, 2, C.woodDark);
  }
});

function post(p: Pixels, x: number, top: number, bottom: number): void {
  p.rect(x - 1, top - 1, 4, bottom - top + 2, C.outline);
  p.rect(x, top, 2, bottom - top, C.fencePost);
  p.px(x, top, C.fencePostLight);
}

/** Chain-link diamonds inside a rectangle. */
function mesh(p: Pixels, x0: number, y0: number, x1: number, y1: number): void {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if ((x + y) % 4 === 0 || (x - y + 64) % 4 === 0) p.px(x, y, C.fenceMesh);
    }
  }
}

/** A fence panel running left–right, seen from the front. */
export const drawFenceH = pixelArt(
  (p) => {
    const top = 6;
    const base = p.h - 3;
    p.rect(0, base, p.w, 3, C.shadow);
    mesh(p, 0, top + 3, p.w, base - 2);
    p.rect(0, top + 1, p.w, 2, C.fenceMesh);
    p.rect(0, top + 3, p.w, 1, C.fencePost);
    p.rect(0, base - 3, p.w, 1, C.fenceMesh);
    post(p, 1, top, base);
    post(p, p.w - 3, top, base);
  },
  { outline: false },
);

/** A fence running up–down the screen: seen edge-on, a narrow strip with a post at the near end. */
export const drawFenceV = pixelArt(
  (p) => {
    const cx = p.w / 2;
    const base = p.h - 3;
    p.rect(cx, p.h - 32, 4, 32, C.shadow);
    mesh(p, cx - 2, 0, cx + 2, base - 4);
    p.rect(cx - 2, 0, 1, base - 4, C.fenceMesh);
    p.rect(cx + 1, 0, 1, base - 4, C.fenceMesh);
    post(p, cx - 1, base - 26, base);
  },
  { outline: false },
);
