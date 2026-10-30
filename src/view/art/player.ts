// The worker, in the reference's style: blue cap, red shirt, jeans. Coordinates are art pixels
// in a 32×40 frame, with the feet at row 37.
import { PALETTE as C } from './palette';
import { ART_SCALE, pixelArt, type Pixels } from './pixel';

/** Frame size in render pixels; the feet sit at FEET_Y, which becomes the sprite's origin. */
export const PLAYER_SIZE = { w: 64, h: 80 } as const;
export const FEET_Y = 37 * ART_SCALE;

function shadow(p: Pixels): void {
  p.ellipse(16, 37.5, 6, 2, C.shadow);
}

function legs(p: Pixels): void {
  p.rect(12, 30, 3, 6, C.jeans);
  p.rect(17, 30, 3, 6, C.jeans);
  p.rect(14, 30, 1, 6, C.jeansDark);
  p.rect(12, 35, 3, 2, C.boots);
  p.rect(17, 35, 3, 2, C.boots);
}

function torso(p: Pixels, x: number, w: number): void {
  p.rect(x, 21, w, 10, C.shirt);
  p.rect(x + w - 1, 21, 1, 10, C.shirtDark);
  p.rect(x, 30, w, 1, C.shirtDark);
}

function arm(p: Pixels, x: number): void {
  p.rect(x, 22, 2, 6, C.shirt);
  p.rect(x, 28, 2, 2, C.skin);
}

function head(p: Pixels, cx: number): void {
  p.ellipse(cx, 15.5, 5, 5.5, C.skin);
  p.rect(cx + 3, 13, 1, 6, C.skinDark);
}

/** Cap crown, plus a brim of `brimW` pixels starting at `brimX`. */
function cap(p: Pixels, brimX: number, brimW: number): void {
  p.rect(11, 9, 10, 4, C.cap);
  p.rect(12, 8, 8, 1, C.cap);
  p.rect(13, 9, 3, 1, '#5b93e6');
  p.rect(brimX, 13, brimW, 1, C.capDark);
}

/** Facing the camera. */
export const drawPlayerDown = pixelArt((p) => {
  shadow(p);
  legs(p);
  arm(p, 9);
  arm(p, 21);
  torso(p, 11, 10);
  head(p, 16);
  cap(p, 11, 10);
  p.px(14, 16, C.outline);
  p.px(18, 16, C.outline);
  p.rect(15, 19, 2, 1, C.skinDark);
});

/** Facing away from the camera. */
export const drawPlayerUp = pixelArt((p) => {
  shadow(p);
  legs(p);
  arm(p, 9);
  arm(p, 21);
  torso(p, 11, 10);
  head(p, 16);
  p.rect(11, 13, 10, 5, C.hair);
  cap(p, 12, 8);
});

/** Facing left; mirrored for right. */
export const drawPlayerSide = pixelArt((p) => {
  shadow(p);
  p.rect(13, 30, 3, 6, C.jeansDark);
  p.rect(16, 30, 3, 6, C.jeans);
  p.rect(12, 35, 4, 2, C.boots);
  p.rect(16, 35, 3, 2, C.boots);
  torso(p, 12, 8);
  arm(p, 14);
  head(p, 16);
  p.rect(18, 12, 3, 6, C.hair);
  cap(p, 7, 6);
  p.px(13, 16, C.outline);
});
