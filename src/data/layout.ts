// The Milestone 1 yard. Grid x runs down-right on screen and y down-left, so the chain
// (gate → pile → shredder → bins) reads from the top-left of the screen towards the bottom-right.
//
// Ground:  .  dirt      :  concrete   =  road      g  grass     ~  water (solid)
// Solid:   #  fence     T  tree       L  lamp post B  guard booth   x  crate
// Other:   P  player start (dirt)
//
// Stations (machines, piles, bins) are listed separately below; their footprints are solid.

import type { StationDef } from '../sim/stations';
import type { UpgradeId } from './upgrades';
import { BINS, BUILD_COSTS, CAN_LINE, PRESS, PILE, SHREDDER } from './balance';

export const YARD: readonly string[] = [
  'gTggggggTgTTgTTTTggggTggTgTgTTgggg',
  'ggTTTgTTgTggTggTTggTggTgTTgggTgTgT',
  'Tggggggggggggggggggggggggggggggggg',
  'gg############################gTgT',
  'gg#..........................#ggTT',
  'gg#.................L......xx#gTTg',
  'gg#...........:::::.........x#gTTg',
  'Tg#...........:::::..........#gTgT',
  'gg#......::::::::::..........#gTgg',
  'TB#......::::::::::..........#gTgT',
  'gg#......::::::::::..........#gTgg',
  '=========::::::::::..........#gTTT',
  '=========::::::::::..........#gTgT',
  'gg#...........:::::..........#gggg',
  'gg#......L....:::::..........#ggTT',
  'gg#..........................#gTgg',
  'gg#......P..............L....#gggg',
  'Tg#........................x.#gggg',
  'Tg#........................x.#gggg',
  'Tg#..........................#gTTT',
  'Tg############################gggT',
  'gggggggggggggggggggggggg~~~~~~~~~~',
  'TTggggTgTgTTgT~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
];

/**
 * Zones are where the player stands to interact (tested against the player's centre).
 * Processor input sits on the front-left (+y) side and output on the front-right (+x) side,
 * so the player is never hidden behind the machine while using it.
 */
export const STATIONS: readonly StationDef[] = [
  {
    id: 'pile',
    kind: 'pile',
    // On the near side of the road, so the parked truck never hides it.
    rect: { x: 5, y: 13, w: 2, h: 2 },
    capacity: PILE.capacity,
    // Take from the front-left side. Returning scrap is on the gate side, away from the walk to the
    // shredder, so the player never steps on it by accident.
    zones: { take: { x: 4, y: 15, w: 4, h: 1 }, return: { x: 4, y: 13, w: 1, h: 2 } },
  },
  {
    id: 'shredder',
    kind: 'processor',
    rect: { x: 10, y: 9, w: 2, h: 2 },
    recipe: SHREDDER,
    speedUpgrade: 'shredderSpeed',
    zones: { input: { x: 10, y: 11, w: 2, h: 1 }, output: { x: 12, y: 9, w: 1, h: 2 } },
  },
  {
    id: 'bin-iron',
    kind: 'bin',
    item: 'iron',
    rect: { x: 15, y: 7, w: 2, h: 2 },
    capacity: BINS.capacity,
    // Drop off from the shredder side (x 14) and the front (row 9). Sell from behind (row 6): a dead end,
    // off every route (pile → shredder → bins, bins → factory), so nobody sells by walking past.
    zones: { deposit: { x: 14, y: 7, w: 3, h: 3 }, sell: { x: 15, y: 6, w: 2, h: 1 } },
  },
  {
    id: 'bin-aluminium',
    kind: 'bin',
    item: 'aluminium',
    rect: { x: 15, y: 11, w: 2, h: 2 },
    capacity: BINS.capacity,
    // Drop off from the shredder side and the back (row 10). Sell from the front (row 13), a dead end.
    zones: { deposit: { x: 14, y: 10, w: 3, h: 3 }, sell: { x: 15, y: 13, w: 2, h: 1 } },
  },
  // The factory: one building whose production lines pull from the bins through chutes and sell what
  // they make straight away. Lines are bought, in order, on the build pad in front.
  {
    id: 'factory',
    kind: 'factory',
    rect: { x: 19, y: 7, w: 4, h: 6 },
    lines: [
      { id: 'press', name: 'machine.press', recipe: PRESS, feeds: ['bin-iron'], buildCost: BUILD_COSTS.press },
      { id: 'can-line', name: 'machine.canLine', recipe: CAN_LINE, feeds: ['bin-aluminium'], buildCost: BUILD_COSTS.canLine },
    ],
    chutes: [
      { x: 17, y: 7, length: 2, line: 'press' },
      { x: 17, y: 11, length: 2, line: 'can-line' },
    ],
    zones: { build: { x: 20, y: 13, w: 2, h: 1 } },
  },
  // Upgrade pads, each beside what it improves and off the main walking routes.
  cashPad('pad-supply', 'supply', 6, 6),
  cashPad('pad-shredder', 'shredderSpeed', 12, 12),
  cashPad('pad-bins', 'binSize', 15, 15),
  cashPad('pad-carry', 'carry', 11, 17),
];

function cashPad(id: string, upgrade: UpgradeId, x: number, y: number): StationDef {
  const rect = { x, y, w: 1, h: 1 };
  return { id, kind: 'cashPad', upgrade, rect, zones: { buy: rect } };
}

/** The supplier truck drives along the road on row `row`, from off-map to its parking spot by the pile. */
export const TRUCK_ROUTE = {
  pile: 'pile',
  row: 11,
  /** Tiles long, along grid x. */
  length: 3,
  startX: -5,
  parkX: 4,
} as const;
