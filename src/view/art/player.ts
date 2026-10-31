// Workers, in the reference's style. The player: blue cap, red shirt, jeans. Employees: yellow hard hat and
// a green work shirt, so they're easy to tell apart. Coordinates are art pixels in a 32×40 frame, with the
// feet at row 37. Isometric: the front pose faces down-left (mirrored for down-right), the back pose faces
// up-right (mirrored for up-left).
import { PALETTE as C } from './palette';
import { ART_SCALE, pixelArt, type Pixels } from './pixel';

/** Frame size in render pixels; the feet sit at FEET_Y, which becomes the sprite's origin. */
export const PLAYER_SIZE = { w: 64, h: 80 } as const;
export const FEET_Y = 37 * ART_SCALE;

interface Outfit {
  shirt: string;
  shirtDark: string;
  cap: string;
  capLight: string;
  capDark: string;
}

const PLAYER_OUTFIT: Outfit = { shirt: C.shirt, shirtDark: C.shirtDark, cap: C.cap, capLight: '#5b93e6', capDark: C.capDark };
const STAFF_OUTFIT: Outfit = { shirt: '#3fae5a', shirtDark: '#2a8a44', cap: C.safety, capLight: '#ffe58a', capDark: C.safetyDark };

function shadow(p: Pixels): void {
  p.ellipse(16, 37.5, 6, 2, C.shadow);
}

function legs(p: Pixels): void {
  p.rect(12, 30, 3, 6, C.jeans);
  p.rect(17, 30, 3, 6, C.jeansDark);
  p.rect(11, 35, 4, 2, C.boots);
  p.rect(17, 35, 3, 2, C.boots);
}

function torso(p: Pixels, o: Outfit): void {
  p.rect(11, 21, 10, 10, o.shirt);
  p.rect(18, 21, 3, 10, o.shirtDark);
  p.rect(11, 30, 10, 1, o.shirtDark);
}

function arm(p: Pixels, x: number, shade: string): void {
  p.rect(x, 22, 2, 6, shade);
  p.rect(x, 28, 2, 2, C.skin);
}

function head(p: Pixels): void {
  p.ellipse(16, 15.5, 5, 5.5, C.skin);
  p.rect(19, 13, 1, 6, C.skinDark);
}

function cap(p: Pixels, o: Outfit): void {
  p.rect(11, 9, 10, 4, o.cap);
  p.rect(12, 8, 8, 1, o.cap);
  p.rect(13, 9, 3, 1, o.capLight);
}

/** Facing down-left (towards the camera). */
function front(o: Outfit) {
  return pixelArt((p) => {
    shadow(p);
    legs(p);
    arm(p, 21, o.shirtDark);
    torso(p, o);
    arm(p, 9, o.shirt);
    head(p);
    cap(p, o);
    p.rect(8, 13, 9, 1, o.capDark);
    p.px(13, 16, C.outline);
    p.px(16, 16, C.outline);
    p.rect(13, 19, 2, 1, C.skinDark);
  });
}

/** Facing up-right (away from the camera). */
function back(o: Outfit) {
  return pixelArt((p) => {
    shadow(p);
    legs(p);
    arm(p, 9, o.shirtDark);
    torso(p, o);
    arm(p, 21, o.shirt);
    head(p);
    p.rect(11, 13, 10, 5, C.hair);
    cap(p, o);
    p.rect(17, 12, 6, 1, o.capDark);
  });
}

export const drawPlayerFront = front(PLAYER_OUTFIT);
export const drawPlayerBack = back(PLAYER_OUTFIT);
export const drawStaffFront = front(STAFF_OUTFIT);
export const drawStaffBack = back(STAFF_OUTFIT);
