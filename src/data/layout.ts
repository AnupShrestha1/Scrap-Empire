// The yard, seen from the south: grid x runs east (screen right) and y south (towards the camera), so the
// chain (gate → dump site → shredder → bins → factory → loading bay → east gate) reads left to right.
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
import type { MetalId } from './items';
import { BINS, FIELD, SHREDDER } from './balance';

export const YARD: readonly string[] = [
  'gTggggggTgTTgTTTTggggTggTgTgTTggggggTTTgTTgTggTggTTggTgg',
  'TgTTgggTgTgTTggggTgTggTTgTTggTTgTTgTgTggTTgTTggTTTTgTggg',
  'ggggggggggggggggggggggggggggggggggggggggggggggggggggggTT',
  'gg##################################################gTgg',
  'gg#................................................#gggg',
  'Tg#............................L...................#gggg',
  'Tg#.dddddddddddddd.....................::::::::::::#gggg',
  'Tg#.dddddddddddddd........:::::::......::::::::::::#gTTT',
  'Tg#.dddddddddddddd........:::::::......::::::::::::=====',
  'gg#.dddddddddddddd.::::::.:::::::......::::::::::::=====',
  'gB#.dddddddddddddd.::::::.:::::::......::::::::::::=====',
  'gg#.dddddddddddddd.::::::.:::::::......::::::::::::=====',
  '====dddddddddddddd.::::::.:::::::......::::::::::::=====',
  '====dddddddddddddd.::::::.:::::::......::::::::::::=====',
  'gg#.dddddddddddddd.::::::.:::::::......::::::::::::=====',
  'Tg#.dddddddddddddd.::::::.:::::::......::::::::::::#ggTT',
  'gg#.dddddddddddddd........:::::::......::::::::::::#gggg',
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

/** Price and business level of each factory line slot, in buying order. */
const LINE_SLOTS: readonly { buildCost: number; requiresLevel: number }[] = [
  { buildCost: 300, requiresLevel: 3 },
  { buildCost: 1200, requiresLevel: 4 },
  { buildCost: 4000, requiresLevel: 5 },
  { buildCost: 12000, requiresLevel: 6 },
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
  // Storage: one bin per metal in a 2 × 3 block, common metals on the left. Carry metal into the gaps
  // beside a bin and it goes in; the walkways between rows are free. Metal is sold at the Scrap Dealer.
  bin('bin-iron', 'iron', 27, 8),
  bin('bin-aluminium', 'aluminium', 27, 11),
  bin('bin-copper', 'copper', 27, 14),
  bin('bin-titanium', 'titanium', 30, 8),
  bin('bin-gold', 'gold', 30, 11),
  bin('bin-platinum', 'platinum', 30, 14),
  // The Scrap Dealer buys raw metal, south of the bins: a dead end off the route to the factory.
  { id: 'dealer', kind: 'dealer', rect: { x: 28, y: 18, w: 3, h: 1 }, zones: { sell: { x: 28, y: 17, w: 3, h: 1 } } },
  // The factory: four line slots, each making whatever it's set to; products come out on the bay side.
  {
    id: 'factory',
    kind: 'factory',
    rect: { x: 34, y: 8, w: 4, h: 8 },
    speedUpgrade: 'lineSpeed',
    lines: LINE_SLOTS.map((slot, i) => ({ id: `line-${i + 1}`, ...slot, output: { x: 38, y: 8 + i * 2, w: 1, h: 1 } })),
    // The build pad (buy the next line) in front; the recipe pad (choose what each line makes) behind,
    // a dead end beside the line speed pad.
    zones: { build: { x: 36, y: 16, w: 2, h: 1 }, recipes: { x: 37, y: 6, w: 1, h: 1 } },
  },
  // Upgrade pads, each near what it improves and off the walking routes.
  cashPad('pad-supply', 'supply', 7, 23),
  cashPad('pad-carry', 'carry', 10, 23),
  cashPad('pad-magnet', 'magnet', 13, 23),
  cashPad('pad-shredder', 'shredderSpeed', 21, 9),
  cashPad('pad-yield', 'shredderYield', 23, 9),
  cashPad('pad-extraction', 'extraction', 25, 9),
  cashPad('pad-bins', 'binSize', 32, 20),
  // Line speed behind the factory, a dead end.
  cashPad('pad-line-speed', 'lineSpeed', 35, 6),
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

/** A 2 × 2 bin; metal goes in from the tiles either side of it. */
function bin(id: string, item: MetalId, x: number, y: number): StationDef {
  return { id, kind: 'bin', item, rect: { x, y, w: 2, h: 2 }, capacity: BINS.capacity, zones: { deposit: { x: x - 1, y, w: 4, h: 2 } } };
}

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
