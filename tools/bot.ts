// A simple player for tuning: plays the real simulation with no graphics and reports when things happen.
// Walking takes distance / walking speed; at each moment the bot does the most sensible next thing.
import { businessLevel } from '../src/data/balance';
import { ITEM_IDS, type ItemId } from '../src/data/items';
import { STATIONS, TRUCK_ROUTE, YARD } from '../src/data/layout';
import { PLAYER } from '../src/data/player';
import { UPGRADE_IDS, UPGRADES, upgradeCost, type UpgradeId } from '../src/data/upgrades';
import { SIM, TICK_MS } from '../src/config';
import { binCapacity, carryCapacity } from '../src/sim/effective';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { Simulation } from '../src/sim/simulation';
import { createNewGame } from '../src/sim/state';
import type { BinDef, CashPadDef, DumpDef, FactoryDef, ProcessorDef, Rect } from '../src/sim/stations';
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
const METALS: readonly ItemId[] = ['iron', 'aluminium', 'copper'];

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Order the bot buys upgrades in when it can afford several: what moves the economy most first. */
const UPGRADE_PRIORITY: readonly UpgradeId[] = [
  'carry', 'magnet', 'shredderSpeed', 'supply', 'binSize', 'pressSpeed', 'shredderYield', 'canSpeed', 'extraction',
];

export function runBot(minutes: number): TimelineEntry[] {
  const sim = new Simulation(createNewGame(grid, STATIONS), grid, STATIONS, TRUCK_ROUTE.dump);
  const s = sim.state;
  const timeline: TimelineEntry[] = [];
  const events: SimEvent[] = [];
  const endTick = minutes * 60 * SIM.tickRate;
  const now = () => s.tick / SIM.tickRate;

  const tick = () => {
    sim.advance(TICK_MS);
    for (const e of sim.drainEvents(events)) {
      if (e.type === 'upgraded') timeline.push({ seconds: now(), what: `${e.upgrade} → Lv ${e.level}`, purchase: true });
      if (e.type === 'built') timeline.push({ seconds: now(), what: `built line ${e.station}`, purchase: true });
      if (e.type === 'levelUp') timeline.push({ seconds: now(), what: `business level ${e.level}`, purchase: false });
      if (e.type === 'objectiveDone') timeline.push({ seconds: now(), what: `objective ${e.objective} (+$${e.reward})`, purchase: false });
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
    for (const id of UPGRADE_PRIORITY) {
      const def = UPGRADES[id];
      const level = s.upgrades[id];
      if (level >= def.maxLevel) continue;
      if (def.requiresLevel && businessLevel(s.earned) < def.requiresLevel) continue;
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

  /** Raw metal worth selling now: anything with no line to use it, or a bin getting full. */
  const binToSell = (): BinDef | undefined =>
    bins.find((b) => {
      const count = s.bins[b.id]!.count;
      const used = factory.lines.some((l) => s.lines[l.id]!.built && l.feeds.includes(b.id));
      return count >= binCapacity(b, s) * (used ? 0.9 : 0.3);
    });

  while (s.tick < endTick) {
    const metal = METALS.find(carrying);
    if (metal) {
      const bin = bins.find((b) => b.item === metal)!;
      if (s.bins[bin.id]!.count >= binCapacity(bin, s)) {
        goTo(bin.zones.sell);
        stand(() => s.bins[bin.id]!.count <= binCapacity(bin, s) / 2);
      }
      goTo(bin.zones.deposit);
      stand(() => !carrying(metal), 4);
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
    const purchase = nextPurchase();
    if (purchase) {
      goTo(purchase.zone);
      stand(purchase.done, 10);
      continue;
    }
    const sell = binToSell();
    if (sell) {
      goTo(sell.zones.sell);
      stand(() => s.bins[sell.id]!.count === 0);
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
  void ITEM_IDS;
  void UPGRADE_IDS;
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
