// A simple player for tuning: plays the real simulation with no graphics and reports when things happen.
// Walking takes distance / walking speed; at each moment the bot does the most sensible next thing.
import { businessLevel } from '../src/data/balance';
import { isMetal, isProduct, type ItemId, type ProductId } from '../src/data/items';
import { RECIPES, recipeMetals } from '../src/data/recipes';
import { STATIONS, TRUCK_ROUTE, YARD } from '../src/data/layout';
import { PLAYER } from '../src/data/player';
import { requiredLevel, UPGRADES, upgradeCost, type UpgradeId } from '../src/data/upgrades';
import { SIM, TICK_MS } from '../src/config';
import { binCapacity, carryCapacity, productUnlocked } from '../src/sim/effective';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { Simulation } from '../src/sim/simulation';
import { createNewGame } from '../src/sim/state';
import type { BayDef, BinDef, CashPadDef, DealerDef, DumpDef, FactoryDef, OutletDef, ProcessorDef, Rect } from '../src/sim/stations';
import { LINE_OUTPUT, STAFF } from '../src/data/balance';
import type { StaffHutDef } from '../src/sim/stations';
import { PIECE_KINDS } from '../src/data/scrap';
import { nextUnbuiltLine } from '../src/sim/systems/manufacturing';
import { trayTotal } from '../src/sim/systems/processing';

export interface TimelineEntry {
  seconds: number;
  what: string;
  /** Purchases (upgrades and lines) count towards the pacing stats. */
  purchase: boolean;
}

const grid = parseGrid(YARD, STATIONS);
const dump = STATIONS.find((s): s is DumpDef => s.kind === 'dump')!;
const shredder = STATIONS.find((s): s is ProcessorDef => s.kind === 'processor')!;
const factory = STATIONS.find((s): s is FactoryDef => s.kind === 'factory')!;
const bins = STATIONS.filter((s): s is BinDef => s.kind === 'bin');
const pads = STATIONS.filter((s): s is CashPadDef => s.kind === 'cashPad');
const bayDefs = STATIONS.filter((s): s is BayDef => s.kind === 'bay');
const outlet = STATIONS.find((s): s is OutletDef => s.kind === 'outlet')!;
const hut = STATIONS.find((s): s is StaffHutDef => s.kind === 'staffHut')!;
const dealer = STATIONS.find((s): s is DealerDef => s.kind === 'dealer')!;

/** What the bot sets each line to make: the first unlocked product in each list. */
const LINE_PLANS: readonly (readonly ProductId[])[] = [
  ['motor', 'sheet'],
  ['radiator', 'toolbox', 'can'],
  ['drillBit', 'wire', 'can'],
  ['circuitBoard', 'watch', 'bikeFrame', 'catalyst'],
];

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Order the bot buys upgrades in when it can afford several: what moves the economy most first. */
const UPGRADE_PRIORITY: readonly UpgradeId[] = [
  'carry', 'magnet', 'shredderSpeed', 'staffCarry', 'supply', 'staffSpeed', 'extraction', 'binSize', 'lineSpeed', 'shredderYield',
];

export function runBot(minutes: number): TimelineEntry[] {
  const sim = new Simulation(createNewGame(grid, STATIONS), grid, STATIONS, TRUCK_ROUTE.dump);
  const s = sim.state;
  const timeline: TimelineEntry[] = [];
  const events: SimEvent[] = [];
  const endTick = minutes * 60 * SIM.tickRate;
  const now = () => s.tick / SIM.tickRate;
  let firstSale = false;
  const found = new Set<ItemId>();

  const tick = () => {
    sim.advance(TICK_MS);
    for (const e of sim.drainEvents(events)) {
      if (e.type === 'upgraded') timeline.push({ seconds: now(), what: `${e.upgrade} → Lv ${e.level}`, purchase: true });
      if (e.type === 'built') timeline.push({ seconds: now(), what: `built line ${e.station}`, purchase: true });
      if (e.type === 'levelUp') timeline.push({ seconds: now(), what: `business level ${e.level}`, purchase: false });
      if (e.type === 'hired') timeline.push({ seconds: now(), what: `hired employee ${e.count}`, purchase: true });
      if (e.type === 'orderFilled') timeline.push({ seconds: now(), what: `order filled: ${e.item} (+$${e.value})`, purchase: false });
      if (e.type === 'objectiveDone') timeline.push({ seconds: now(), what: `objective ${e.objective} (+$${e.reward})`, purchase: false });
      if (e.type === 'sold' && !firstSale) {
        firstSale = true;
        timeline.push({ seconds: now(), what: `first sale: ${e.item} (+$${e.value})`, purchase: false });
      }
      if (e.type === 'found' && !found.has(e.item)) {
        found.add(e.item);
        timeline.push({ seconds: now(), what: `first ${e.item} found`, purchase: false });
      }
    }
  };

  /** Walks to the centre of `zone` (time passes, the player is out of every zone on the way). */
  const goTo = (zone: Rect) => goToPoint(centre(zone));

  const goToPoint = (to: { x: number; y: number }) => {
    const distance = Math.hypot(to.x - s.player.x, to.y - s.player.y);
    const ticks = Math.ceil((distance / PLAYER.speed) * SIM.tickRate);
    s.player.x = grid.playerStart.x;
    s.player.y = grid.playerStart.y;
    for (let i = 0; i < ticks && s.tick < endTick; i++) tick();
    s.player.x = to.x;
    s.player.y = to.y;
  };

  /** Stands still until `done()` or `maxSeconds` pass. */
  const stand = (done: () => boolean, maxSeconds = 8) => {
    const until = s.tick + maxSeconds * SIM.tickRate;
    while (!done() && s.tick < until && s.tick < endTick) tick();
  };

  const carrying = (item: ItemId) => s.player.stack.includes(item);

  /** The cheapest thing worth buying right now, if affordable. */
  const nextPurchase = (): { zone: Rect; done: () => boolean } | undefined => {
    const line = nextUnbuiltLine(factory, s);
    if (line && (!line.requiresLevel || businessLevel(s.earned) >= line.requiresLevel)) {
      if (s.money + s.buildPaid[line.id]! >= line.buildCost) return { zone: factory.zones.build, done: () => s.lines[line.id]!.built };
    }
    // A free hire as soon as the hut opens; later ones once a line exists.
    const hireCost = STAFF.costs[s.employees.length];
    const hutOpen = businessLevel(s.earned) >= STAFF.requiresLevel;
    if (hireCost !== undefined && hutOpen && (hireCost === 0 || s.lines['line-1']?.built) && s.money + s.hirePaid >= hireCost) {
      const before = s.employees.length;
      return { zone: hut.zones.hire, done: () => s.employees.length > before };
    }
    for (const id of UPGRADE_PRIORITY) {
      const def = UPGRADES[id];
      const level = s.upgrades[id];
      if (level >= def.maxLevel) continue;
      if (businessLevel(s.earned) < requiredLevel(id, level)) continue;
      if (def.requiresLine && !s.lines[def.requiresLine]?.built) continue;
      // Keep saving for the next line while one is affordable soon.
      if (line && line.buildCost < upgradeCost(id, level) * 2 && s.money < line.buildCost) continue;
      if (s.money + s.upgradePaid[id] >= upgradeCost(id, level)) {
        const pad = pads.find((p) => p.upgrade === id)!;
        return { zone: pad.zones.buy, done: () => s.upgrades[id] > level };
      }
    }
    return undefined;
  };

  /** Metals some built line uses: worth storing; everything else goes to the Scrap Dealer. */
  const metalsInUse = (): Set<ItemId> => {
    const used = new Set<ItemId>();
    for (const l of factory.lines) if (s.lines[l.id]!.built) for (const m of recipeMetals(s.lines[l.id]!.product)) used.add(m);
    return used;
  };

  /** Sets each built line to the best unlocked product in its plan, until employees run the lines on Auto. */
  const planLines = () => {
    if (s.employees.length > 0) return;
    factory.lines.forEach((l, i) => {
      if (!s.lines[l.id]!.built) return;
      const want = LINE_PLANS[i]!.find((p) => productUnlocked(p, s));
      if (want && s.lines[l.id]!.product !== want) sim.setLineProduct(l.id, want);
    });
  };

  /** A truck waiting for `item`, if any. */
  const truckWanting = (item: ItemId) =>
    bayDefs.find((b) => {
      const bay = s.bays[b.id]!;
      return bay.phase === 'waiting' && bay.item === item && bay.have < bay.want;
    });

  while (s.tick < endTick) {
    planLines();
    const product = s.player.stack.find((i) => isProduct(i));
    if (product) {
      const bay = truckWanting(product);
      if (bay) {
        goTo(bay.zones.load);
        stand(() => !carrying(product) || s.bays[bay.id]!.phase !== 'waiting', 4);
      } else {
        goTo(outlet.zones.sell);
        stand(() => !s.player.stack.some((i) => isProduct(i)), 8);
      }
      continue;
    }
    // Collect products when a truck wants them, or when a line's output is full and it would stall.
    const ready = factory.lines.find((l) => {
      const { out, outItem } = s.lines[l.id]!;
      return out > 0 && outItem && (truckWanting(outItem) || out >= LINE_OUTPUT || outItem !== s.lines[l.id]!.product);
    });
    if (ready && s.player.stack.length === 0) {
      goTo(ready.output);
      stand(() => s.player.stack.length >= carryCapacity(s) || s.lines[ready.id]!.out === 0, 4);
      continue;
    }
    const metal = s.player.stack.find((i) => isMetal(i));
    if (metal) {
      const used = metalsInUse();
      const binOf = (m: ItemId) => bins.find((b) => b.item === m)!;
      const storable = (m: ItemId) => used.has(m) && s.bins[binOf(m).id]!.count < binCapacity(binOf(m), s);
      if (storable(metal)) {
        const bin = binOf(metal);
        goTo(bin.zones.deposit);
        stand(() => !carrying(metal) || s.bins[bin.id]!.count >= binCapacity(bin, s), 4);
      } else {
        // Everything no line needs, or with a full bin, goes to the Scrap Dealer.
        goTo(dealer.zones.sell);
        stand(() => !s.player.stack.some((i) => isMetal(i) && !storable(i)), 8);
      }
      continue;
    }
    // Empty-handed with cash to spend: buy before the next chore (employees keep the tray busy).
    const purchase = s.player.stack.length === 0 ? nextPurchase() : undefined;
    if (purchase) {
      goTo(purchase.zone);
      stand(purchase.done, 10);
      continue;
    }
    if (carrying('scrap')) {
      goTo(shredder.zones.input);
      stand(() => !carrying('scrap') || s.processors[shredder.id]!.hopper >= shredder.recipe.hopper, 4);
      if (carrying('scrap')) {
        goTo(dump.zones.return);
        stand(() => !carrying('scrap'), 4);
      }
      continue;
    }
    if (trayTotal(s.processors[shredder.id]!) > 0) {
      goTo(shredder.zones.output);
      stand(() => s.player.stack.length >= carryCapacity(s) || trayTotal(s.processors[shredder.id]!) === 0, 4);
      continue;
    }
    if (s.field.pieces.length > 0 && s.processors[shredder.id]!.hopper < shredder.recipe.hopper) {
      // Sweep the field: walk to the nearest piece that fits, until the hands are full.
      for (let n = 0; n < 40 && s.tick < endTick; n++) {
        const room = carryCapacity(s) - s.player.stack.length;
        let best: { x: number; y: number } | undefined;
        let bestD = Infinity;
        for (const p of s.field.pieces) {
          if (PIECE_KINDS[p.kind]!.units > room) continue;
          const d = Math.hypot(p.x - s.player.x, p.y - s.player.y);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
        if (!best) break;
        const before = s.player.stack.length;
        goToPoint({ x: best.x, y: best.y });
        stand(() => s.player.stack.length > before, 1);
      }
      continue;
    }
    stand(() => false, 1);
  }
  void RECIPES;
  return timeline;
}

/** Pacing stats over the first `minutes`: gaps between purchases, in seconds. */
export function purchaseGaps(timeline: readonly TimelineEntry[], minutes: number): { count: number; average: number; longest: number } {
  const times = timeline.filter((e) => e.purchase && e.seconds <= minutes * 60).map((e) => e.seconds);
  const gaps = times.map((t, i) => t - (times[i - 1] ?? 0));
  return {
    count: times.length,
    average: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity,
    longest: gaps.length ? Math.max(...gaps, minutes * 60 - (times.at(-1) ?? 0)) : Infinity,
  };
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
