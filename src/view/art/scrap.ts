// Scrap pieces lying on the dump site, one sprite per kind (see data/scrap.ts). Art pixels.
import { PIECE_KINDS } from '../../data/scrap';
import { along, isoBox } from './isoshapes';
import { PALETTE as C } from './palette';
import { pixelArt, type Pixels } from './pixel';
import { drawProductIcon } from './factory';

/** Frame sizes: small pieces fit a third of a tile, big ones most of a tile. The origin is the piece's ground point. */
export const SMALL_PIECE_FRAME = { w: 36, h: 28, originY: 22 / 28 } as const;
export const BIG_PIECE_FRAME = { w: 60, h: 48, originY: 38 / 48 } as const;

export function pieceFrame(kind: number) {
  return PIECE_KINDS[kind]!.units > 1 ? BIG_PIECE_FRAME : SMALL_PIECE_FRAME;
}

function shadow(p: Pixels, cx: number, cy: number, rx: number): void {
  p.ellipse(cx, cy, rx, rx / 2.5, C.shadow);
}

const DRAW: Record<string, (p: Pixels) => void> = {
  can(p) {
    shadow(p, 9, 11, 6);
    p.rect(4, 7, 9, 4, C.shirt);
    p.rect(4, 7, 9, 1, '#ff7a6e');
    p.rect(12, 7, 2, 4, C.aluminium);
  },
  pipe(p) {
    shadow(p, 9, 11, 8);
    p.rect(2, 7, 14, 3, C.scrapGrey);
    p.rect(2, 7, 14, 1, '#a7b0bb');
    p.rect(14, 6, 2, 5, C.steelRight);
  },
  gear(p) {
    shadow(p, 9, 11, 6);
    p.ellipse(9, 8, 5, 3, C.steelLeft);
    for (const [x, y] of [[3, 8], [14, 8], [9, 5], [9, 11], [5, 6], [13, 6], [5, 10], [13, 10]] as const) p.px(x, y, C.steelLeft);
    p.ellipse(9, 8, 1.5, 1, C.hole);
  },
  plate(p) {
    shadow(p, 9, 11, 7);
    p.polygon([[2, 9], [10, 5], [16, 8], [8, 12]], C.rust);
    p.rect(8, 7, 3, 2, C.rustLight);
    p.px(5, 9, C.scrapDark);
  },
  tyre(p) {
    shadow(p, 15, 19, 12);
    p.ellipse(15, 15, 11, 6, C.tyre);
    p.ellipse(15, 13, 11, 5.5, '#3a353e');
    p.ellipse(15, 13, 5, 2.5, C.scrapGrey);
    p.ellipse(15, 13, 2.5, 1.2, C.hole);
  },
  door(p) {
    shadow(p, 15, 19, 12);
    p.polygon([[3, 14], [17, 7], [27, 12], [13, 19]], C.truckBlue);
    p.polygon([[7, 13], [16, 9], [21, 11], [12, 15]], C.glass);
    p.rect(19, 13, 3, 1, C.scrapGrey);
    p.rect(9, 16, 2, 2, C.rust);
  },
  fridge(p) {
    shadow(p, 15, 19, 12);
    const g: [number, number] = [14, 10];
    isoBox(p, g, 0.6, 0.35, 8, { top: '#f2f4f6', left: '#d4dbe1', right: '#b3bec7' });
    const [hx, hy] = along(g, 0.3, 0.35);
    p.rect(hx - 3, hy - 5, 6, 1, C.scrapGrey);
  },
  engine(p) {
    shadow(p, 15, 19, 12);
    const g: [number, number] = [14, 10];
    isoBox(p, g, 0.55, 0.45, 9, { top: C.scrapGrey, left: C.scrapDark, right: '#3a3f4a' });
    p.rect(10, 3, 3, 3, C.scrapDark);
    p.rect(17, 3, 3, 3, C.scrapDark);
    p.rect(12, 7, 6, 2, C.rust);
  },
};

const INGOT: Record<string, { top: string; side: string }> = {
  iron: { top: C.iron, side: C.ironDark },
  aluminium: { top: C.aluminium, side: C.aluminiumDark },
  copper: { top: C.copper, side: C.copperDark },
};

/** Something the player dropped: an ingot or a product, lying on the ground. */
function drawDropped(item: string) {
  return (p: Pixels) => {
    shadow(p, 9, 11, 6);
    const g: [number, number] = [9, 6];
    const ingot = INGOT[item];
    if (ingot) isoBox(p, g, 0.5, 0.25, 3, { top: ingot.top, left: ingot.side, right: ingot.side });
    else drawProductIcon(p, g, item as 'sheet' | 'can');
  };
}

export function drawPiece(kind: number) {
  const k = PIECE_KINDS[kind]!;
  return pixelArt(k.item ? drawDropped(k.item) : DRAW[k.id]!);
}

