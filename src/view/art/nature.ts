// Yard dressing from the reference: trees, lamp posts and the gate booth. Art pixels.
import { along, isoBox, isoFrame, up } from './isoshapes';
import { PALETTE as C } from './palette';
import { pixelArt } from './pixel';

export const TREE_FRAME = isoFrame(1, 1, 44);
export const TREE_VARIANTS = 2;

export function drawTree(variant: number) {
  return pixelArt((p) => {
    const [cx, cy] = along(TREE_FRAME.ground, 0.5, 0.5);
    p.ellipse(cx + 2, cy, 11, 4, C.shadow);
    p.rect(cx - 1, cy - 12, 3, 12, C.trunk);
    const s = variant === 0 ? 1 : 0.85;
    const lift = variant === 0 ? 0 : 3;
    p.ellipse(cx, cy - 24 - lift, 12 * s, 12 * s, C.leafDark);
    p.ellipse(cx - 1, cy - 26 - lift, 10 * s, 10 * s, C.leaf);
    p.ellipse(cx - 3, cy - 29 - lift, 6 * s, 5 * s, C.leafLight);
    p.ellipse(cx + 4, cy - 22 - lift, 4 * s, 3 * s, C.leafLight);
  });
}

export const LAMP_POST_FRAME = isoFrame(1, 1, 46);

export const drawLampPost = pixelArt((p) => {
  const [cx, cy] = along(LAMP_POST_FRAME.ground, 0.5, 0.5);
  p.ellipse(cx, cy, 4, 2, C.shadow);
  p.rect(cx - 1, cy - 40, 2, 40, C.fencePost);
  p.rect(cx - 1, cy - 41, 7, 2, C.fencePost);
  p.rect(cx + 3, cy - 39, 4, 2, C.lampYellow);
});

export const BOOTH_FRAME = isoFrame(1, 1, 28);

export const drawBooth = pixelArt((p) => {
  const g = BOOTH_FRAME.ground;
  isoBox(p, g, 1, 1, 19, { top: C.boothWall, left: C.boothWall, right: C.boothWallDark });
  // Windows on both front faces, a door on the right.
  const w0 = along(g, 0.2, 1);
  const w1 = along(g, 0.8, 1);
  p.polygon([up(w0, 15), up(w1, 15), up(w1, 9), up(w0, 9)], C.glass);
  const d0 = along(g, 1, 0.3);
  const d1 = along(g, 1, 0.7);
  p.polygon([up(d0, 14), up(d1, 14), d1, d0], C.trunk);
  // A slightly wider roof slab.
  isoBox(p, along(g, -0.125, -0.125), 1.25, 1.25, 23, { top: C.roof, left: C.roofDark, right: C.roofDark }, 19);
});

export const HUT_FRAME = isoFrame(2, 2, 34);

/** The staff hut: a wooden cabin with a green roof and a door facing the hire pad. */
export const drawHut = pixelArt((p) => {
  const g = HUT_FRAME.ground;
  isoBox(p, g, 2, 2, 20, { top: C.woodLight, left: C.wood, right: C.woodDark });
  // Plank lines on the front walls.
  for (let h = 4; h < 20; h += 4) {
    for (const [from, to] of [[along(g, 0, 2), along(g, 2, 2)], [along(g, 2, 2), along(g, 2, 0)]] as const) {
      for (let t = 0; t <= 32; t++) {
        const x = Math.round(from[0] + ((to[0] - from[0]) * t) / 32);
        const y = Math.round(from[1] + ((to[1] - from[1]) * t) / 32) - h;
        p.px(x, y, C.woodDark);
      }
    }
  }
  const d0 = along(g, 0.7, 2);
  const d1 = along(g, 1.3, 2);
  p.polygon([up(d0, 14), up(d1, 14), d1, d0], C.trunk);
  const w0 = along(g, 2, 0.6);
  const w1 = along(g, 2, 1.4);
  p.polygon([up(w0, 15), up(w1, 15), up(w1, 9), up(w0, 9)], C.glass);
  isoBox(p, along(g, -0.125, -0.125), 2.25, 2.25, 26, { top: '#4f9a3e', left: '#3f8a3a', right: '#2a5e2c' }, 20);
});
