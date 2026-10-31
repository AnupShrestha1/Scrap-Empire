// The yard. Grid x runs down-right on screen and y down-left, so the chain (gate → dump site → shredder
// → bins → factory) reads from the top-left of the screen towards the bottom-right.
//
// Ground:  .  dirt      :  concrete   =  road      g  grass     ~  water (solid)   d  dump ground
// Solid:   #  fence     T  tree       L  lamp post B  guard booth   x  crate
// Other:   P  player start (dirt)
//
// Stations (machines, bins, the dump site) are listed separately below. Machine and bin footprints are
// solid; the dump site and pads are walkable.
//
// Pad rule (see docs and tests): pads that sell, spend or take items back never sit on a walking route.
// Routes: dump field → shredder input → shredder output → each bin's drop-off → factory build pad.

import type { StationDef } from '../sim/stations';
import type { UpgradeId } from './upgrades';
import { BINS, BUILD_COSTS, CAN_LINE, FIELD, PRESS, SHREDDER } from './balance';

export const YARD: readonly string[] = [
  'gTggggggTgTTgTTTTggggTggTgTgTTggggggTTTgTTgTgg',
  'TggTTggTggTgTTgggTgTgTTggggTgTggTTgTTggTTgTTgT',
  'gggggggggggggggggggggggggggggggggggggggggggTgg',
  'Tg########################################gTgT',
  'Tg#......................................#gggT',
  'Tg#............................L......xx.#gTTg',
  'Tg#.dddddddddddddd.....................x.#gggg',
  'gg#.dddddddddddddd........::::...........#ggTT',
  'gg#.dddddddddddddd........::::...........#gTgg',
  'gg#.dddddddddddddd.::::::.::::...........#gggg',
  'TB#.dddddddddddddd.::::::.::::...........#gggg',
  'gg#.dddddddddddddd.::::::.::::...........#gTgg',
  '====dddddddddddddd.::::::.::::...........#ggTT',
  '====dddddddddddddd.::::::.::::...........#gTTT',
  'gg#.dddddddddddddd.::::::.::::...........#gggT',
  'gg#.dddddddddddddd.::::::.::::...........#gTTg',
  'gg#.dddddddddddddd........::::...........#gggT',
  'gg#.dddddddddddddd.L......::::...........#gTgT',
  'Tg#.dddddddddddddd........::::...........#ggTg',
  'Tg#.dddddddddddddd........::::...........#gTgg',
  'gg#.......................::::...........#ggTg',
  'Tg#.......P..............................#gggT',
  'gg#.L..........................L.........#gggT',
  'gg#....................................x.#ggTg',
  'gg#....................................x.#gTgT',
  'Tg#......................................#gTTg',
  'gg########################################ggTT',
  'gggggggggggggggggggg~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

/**
 * Zones are where the player stands to interact (tested against the player's centre). Machine input sits
 * on the front-left (+y) side and output on the front-right (+x) side, so the player is never hidden
 * behind the machine while using it.
 */
export const STATIONS: readonly StationDef[] = [
  {
    // The dump site: the truck tips scrap here and it lies scattered for the player to collect.
    id: 'dump',
    kind: 'dump',
    rect: { x: 4, y: 6, w: 14, h: 14 },
    capacity: FIELD.capacity,
    // Dropping scrap back is on the field's fence side (x 3), a dead end away from the shredder.
    zones: { field: { x: 4, y: 6, w: 14, h: 14 }, return: { x: 3, y: 16, w: 1, h: 2 } },
  },
  {
    id: 'shredder',
    kind: 'processor',
    rect: { x: 21, y: 11, w: 2, h: 2 },
    recipe: SHREDDER,
    speedUpgrade: 'shredderSpeed',
    zones: { input: { x: 21, y: 13, w: 2, h: 1 }, output: { x: 23, y: 11, w: 1, h: 2 } },
  },
  // Bins: drop off from the shredder side (x 26) and one end; sell from the other end, a dead end.
  {
    id: 'bin-iron',
    kind: 'bin',
    item: 'iron',
    rect: { x: 27, y: 8, w: 2, h: 2 },
    capacity: BINS.capacity,
    zones: { deposit: { x: 26, y: 8, w: 3, h: 3 }, sell: { x: 27, y: 7, w: 2, h: 1 } },
  },
  {
    id: 'bin-aluminium',
    kind: 'bin',
    item: 'aluminium',
    rect: { x: 27, y: 12, w: 2, h: 2 },
    capacity: BINS.capacity,
    zones: { deposit: { x: 26, y: 12, w: 3, h: 3 }, sell: { x: 27, y: 11, w: 2, h: 1 } },
  },
  {
    id: 'bin-copper',
    kind: 'bin',
    item: 'copper',
    rect: { x: 27, y: 16, w: 2, h: 2 },
    capacity: BINS.capacity,
    zones: { deposit: { x: 26, y: 16, w: 3, h: 3 }, sell: { x: 27, y: 15, w: 2, h: 1 } },
  },
  // The factory: one building whose production lines pull straight from the bins and sell what they
  // make at once. Lines are bought, in order, on the build pad in front.
  {
    id: 'factory',
    kind: 'factory',
    rect: { x: 33, y: 9, w: 4, h: 6 },
    lines: [
      { id: 'press', name: 'machine.press', recipe: PRESS, feeds: ['bin-iron'], buildCost: BUILD_COSTS.press, speedUpgrade: 'pressSpeed' },
      {
        id: 'can-line',
        name: 'machine.canLine',
        recipe: CAN_LINE,
        feeds: ['bin-aluminium'],
        buildCost: BUILD_COSTS.canLine,
        requiresLevel: 2,
        speedUpgrade: 'canSpeed',
      },
    ],
    zones: { build: { x: 34, y: 15, w: 2, h: 1 } },
  },
  // Upgrade pads, each near what it improves and off the walking routes.
  cashPad('pad-supply', 'supply', 7, 23),
  cashPad('pad-carry', 'carry', 10, 23),
  cashPad('pad-magnet', 'magnet', 13, 23),
  cashPad('pad-shredder', 'shredderSpeed', 20, 9),
  cashPad('pad-yield', 'shredderYield', 22, 9),
  cashPad('pad-extraction', 'extraction', 24, 9),
  cashPad('pad-bins', 'binSize', 30, 20),
  cashPad('pad-press-speed', 'pressSpeed', 37, 10),
  cashPad('pad-can-speed', 'canSpeed', 37, 13),
];

function cashPad(id: string, upgrade: UpgradeId, x: number, y: number): StationDef {
  const rect = { x, y, w: 1, h: 1 };
  return { id, kind: 'cashPad', upgrade, rect, zones: { buy: rect } };
}

/** The supplier truck drives in along the road on row `row`, parks inside the dump site and tips its load. */
export const TRUCK_ROUTE = {
  dump: 'dump',
  row: 12,
  /** Tiles long, along grid x. */
  length: 3,
  startX: -6,
  parkX: 4,
} as const;
