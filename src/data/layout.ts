// The yard. Grid x runs down-right on screen and y down-left, so the chain (gate → dump site → shredder
// → bins → factory → loading bay → east gate) reads from the top-left of the screen towards the bottom-right.
//
// Ground:  .  dirt      :  concrete   =  road      g  grass     ~  water (solid)   d  dump ground
// Solid:   #  fence     T  tree       L  lamp post B  guard booth   x  crate
// Other:   P  player start (dirt)
//
// Stations (machines, bins, the dump site) are listed separately below. Machine and bin footprints are
// solid; the dump site and pads are walkable.
//
// Pad rule (see docs and tests): pads that sell, spend or take items back never sit on a walking route.
// Routes: dump field → shredder input → shredder output → each bin's drop-off → factory build pad,
// and factory line outputs → loading bay truck zones.

import type { StationDef } from '../sim/stations';
import type { UpgradeId } from './upgrades';
import { BINS, BUILD_COSTS, CAN_LINE, FIELD, PRESS, SHREDDER } from './balance';

export const YARD: readonly string[] = [
  'gTggggggTgTTgTTTTggggTggTgTgTTggggggTTTgTTgTggTggTTggTgg',
  'TgTTgggTgTgTTggggTgTggTTgTTggTTgTTgTgTggTTgTTggTTTTgTggg',
  'ggggggggggggggggggggggggggggggggggggggggggggggggggggggTT',
  'gg##################################################gTgg',
  'gg#................................................#gggg',
  'Tg#............................L...................#gggg',
  'Tg#.dddddddddddddd.....................::::::::::::#gggg',
  'Tg#.dddddddddddddd........::::.........::::::::::::#gTTT',
  'Tg#.dddddddddddddd........::::.........::::::::::::=====',
  'gg#.dddddddddddddd.::::::.::::.........::::::::::::=====',
  'gB#.dddddddddddddd.::::::.::::.........::::::::::::=====',
  'gg#.dddddddddddddd.::::::.::::.........::::::::::::=====',
  '====dddddddddddddd.::::::.::::.........::::::::::::=====',
  '====dddddddddddddd.::::::.::::.........::::::::::::=====',
  'gg#.dddddddddddddd.::::::.::::.........::::::::::::=====',
  'Tg#.dddddddddddddd.::::::.::::.........::::::::::::#ggTT',
  'gg#.dddddddddddddd........::::.........::::::::::::#gggg',
  'Tg#.dddddddddddddd.L......::::.........::::::::::::#ggTg',
  'Tg#.dddddddddddddd........::::.........::::::::::::#gTgT',
  'gg#.dddddddddddddd........::::.....................#gTTg',
  'gg#.......................::::.....................#gggT',
  'gg#.......P..................................L.....#gTgg',
  'Tg#.L..........................L...................#gggg',
  'Tg#.................................x..........xx..#gggT',
  'gg#.................................x...........x..#ggTg',
  'Tg#................................................#gTTT',
  'gg##################################################gggT',
  'Tggggggggggggggggggg~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
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
      {
        id: 'press',
        name: 'machine.press',
        recipe: PRESS,
        feeds: ['bin-iron'],
        buildCost: BUILD_COSTS.press,
        speedUpgrade: 'pressSpeed',
        // Products come out on the factory's bay side.
        output: { x: 37, y: 9, w: 1, h: 2 },
      },
      {
        id: 'can-line',
        name: 'machine.canLine',
        recipe: CAN_LINE,
        feeds: ['bin-aluminium'],
        buildCost: BUILD_COSTS.canLine,
        requiresLevel: 2,
        speedUpgrade: 'canSpeed',
        output: { x: 37, y: 12, w: 1, h: 2 },
      },
    ],
    zones: { build: { x: 34, y: 15, w: 2, h: 1 } },
  },
  // Upgrade pads, each near what it improves and off the walking routes.
  cashPad('pad-supply', 'supply', 7, 23),
  cashPad('pad-carry', 'carry', 10, 23),
  cashPad('pad-magnet', 'magnet', 13, 23),
  cashPad('pad-shredder', 'shredderSpeed', 21, 9),
  cashPad('pad-yield', 'shredderYield', 23, 9),
  cashPad('pad-extraction', 'extraction', 25, 9),
  cashPad('pad-bins', 'binSize', 30, 20),
  // Line speed pads behind the factory, a dead end.
  cashPad('pad-press-speed', 'pressSpeed', 34, 8),
  cashPad('pad-can-speed', 'canSpeed', 35, 8),
  // The loading bay: buyer trucks back in along two lanes from the east gate. Load them from the zone at
  // their tail; products can also be sold outright at the outlet, a dead end south of the lanes.
  {
    id: 'bay-a',
    kind: 'bay',
    rect: { x: 44, y: 9, w: 3, h: 1 },
    lane: { row: 9, parkX: 44, startX: 58 },
    zones: { load: { x: 42, y: 8, w: 2, h: 3 } },
  },
  {
    id: 'bay-b',
    kind: 'bay',
    rect: { x: 44, y: 13, w: 3, h: 1 },
    lane: { row: 13, parkX: 44, startX: 58 },
    zones: { load: { x: 42, y: 12, w: 2, h: 3 } },
  },
  // The staff hut below the dump site; hire employees on the pad in front of it (a dead end).
  { id: 'staff-hut', kind: 'staffHut', rect: { x: 16, y: 21, w: 2, h: 2 }, zones: { hire: { x: 16, y: 23, w: 2, h: 1 } } },
  { id: 'outlet', kind: 'outlet', rect: { x: 44, y: 17, w: 2, h: 1 }, zones: { sell: { x: 44, y: 17, w: 2, h: 1 } } },
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
