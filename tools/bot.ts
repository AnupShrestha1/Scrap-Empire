// A sensible player for tuning: plays the real simulation with no graphics and reports what happens.
// Walking takes distance / walking speed; at each moment the bot does the most useful next thing, saves
// up for big unlocks (factory lines, the second shredder, Extraction) when they're near, and keeps its
// small upgrades in step with the stage of the game rather than buying every cheap level.
import { businessLevel, BUSINESS_LEVELS, LINE_OUTPUT, STAFF } from '../src/data/balance';
import { isMetal, isProduct, type ItemId, type ProductId } from '../src/data/items';
import { STATIONS, TRUCK_ROUTE, YARD } from '../src/data/layout';
import { PLAYER } from '../src/data/player';
import { recipeMetals } from '../src/data/recipes';
import { PIECE_KINDS } from '../src/data/scrap';
import { requiredLevel, UPGRADES, upgradeCost, type UpgradeId } from '../src/data/upgrades';
import { SIM, TICK_MS } from '../src/config';
import { binCapacity, carryCapacity, hopperCapacity, productUnlocked } from '../src/sim/effective';
import type { SimEvent } from '../src/sim/events';
import { parseGrid } from '../src/sim/grid';
import { Simulation } from '../src/sim/simulation';
import { createNewGame } from '../src/sim/state';
import type { BayDef, BinDef, CashPadDef, DealerDef, DumpDef, FactoryDef, OutletDef, ProcessorDef, Rect, StaffHutDef } from '../src/sim/stations';
import { nextUnbuiltLine } from '../src/sim/systems/manufacturing';
import { trayTotal } from '../src/sim/systems/processing';

export interface TimelineEntry {
  seconds: number;
  what: string;
  /** Purchases (upgrades, lines, machines, hires) count towards the pacing stats. */
  purchase: boolean;
}

/** Where money came from and went, per window of play. */
export interface BotStats {
  windowS: number;
  income: Record<IncomeSource, number>[];
  /** Throughput per window: scrap delivered and shredded, products made, orders filled and missed. */
  flow: Record<FlowKind, number>[];
  spent: Record<string, number>;
  levelAt: Record<number, number>;
}

export type IncomeSource = 'metal' | 'product' | 'order' | 'staffSales' | 'objective' | 'chest';
export type FlowKind = 'delivered' | 'shredded' | 'made' | 'filled' | 'expired';
const FLOWS: readonly FlowKind[] = ['delivered', 'shredded', 'made', 'filled', 'expired'];
const SOURCES: readonly IncomeSource[] = ['metal', 'product', 'order', 'staffSales', 'objective', 'chest'];

const grid = parseGrid(YARD, STATIONS);
const dump = STATIONS.find((s): s is DumpDef => s.kind === 'dump')!;
const shredders = STATIONS.filter((s): s is ProcessorDef => s.kind === 'processor');
const factory = STATIONS.find((s): s is FactoryDef => s.kind === 'factory')!;
const bins = STATIONS.filter((s): s is BinDef => s.kind === 'bin');
const pads = STATIONS.filter((s): s is CashPadDef => s.kind === 'cashPad');
const bayDefs = STATIONS.filter((s): s is BayDef => s.kind === 'bay');
const outlet = STATIONS.find((s): s is OutletDef => s.kind === 'outlet')!;
const hut = STATIONS.find((s): s is StaffHutDef => s.kind === 'staffHut')!;
const dealer = STATIONS.find((s): s is DealerDef => s.kind === 'dealer')!;

/** What the bot sets each line to make before it has employees to run them on Auto. */
const LINE_PLANS: readonly (readonly ProductId[])[] = [
  ['motor', 'sheet'],
  ['radiator', 'toolbox', 'can'],
  ['drillBit', 'wire', 'can'],
  ['circuitBoard', 'watch', 'bikeFrame', 'catalyst'],
];

const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * Small upgrades in the order the bot values them, each capped by business level so the bot doesn't pour
 * money into level 8 of Carry before it has a factory: cap = base + perLevel × business level.
 */
const UPGRADE_PLAN: readonly { id: UpgradeId; base: number; perLevel: number; needsStaff?: boolean }[] = [
  { id: 'carry', base: 1, perLevel: 1 },
  { id: 'supply', base: -1, perLevel: 1.2 },
  { id: 'shredderCapacity', base: 0, perLevel: 1 },
  { id: 'shredderSpeed', base: 0, perLevel: 1 },
  { id: 'magnet', base: 0, perLevel: 0.7 },
  { id: 'staffCarry', base: 0, perLevel: 1, needsStaff: true },
  { id: 'staffSpeed', base: 0, perLevel: 1, needsStaff: true },
  { id: 'lineSpeed', base: -2, perLevel: 1 },
  { id: 'binSize', base: -1, perLevel: 0.7 },
  { id: 'shredderYield', base: -2, perLevel: 1 },
  { id: 'extraction', base: -4, perLevel: 1.5 },
];

/** How the bot plays: an efficient player, or a casual one who walks slower and stops to think. */
export interface Profile {
  /** Walking time is multiplied by this. */
  walk: number;
  /** Seconds of standing still before each decision. */
  pauseS: number;
}

export const PROFILES = { efficient: { walk: 1, pauseS: 0 }, casual: { walk: 1.35, pauseS: 1 } } as const satisfies Record<string, Profile>;

export function runBot(minutes: number, windowS = 300, profile: Profile = PROFILES.efficient): { timeline: TimelineEntry[]; stats: BotStats } {
  const sim = new Simulation(createNewGame(grid, STATIONS), grid, STATIONS, TRUCK_ROUTE.dump);
  const s = sim.state;
  const timeline: TimelineEntry[] = [];
  const events: SimEvent[] = [];
  const endTick = minutes * 60 * SIM.tickRate;
  const now = () => s.tick / SIM.tickRate;
  const found = new Set<ItemId>();
  let firstSale = false;
  const stats: BotStats = { windowS, income: [], flow: [], spent: {}, levelAt: { 1: 0 } };
  const count = (kind: FlowKind) => {
    const w = Math.floor(now() / windowS);
    while (stats.flow.length <= w) stats.flow.push(Object.fromEntries(FLOWS.map((k) => [k, 0])) as Record<FlowKind, number>);
    stats.flow[w]![kind]++;
  };
  const earn = (source: IncomeSource, value: number) => {
    const w = Math.floor(now() / windowS);
    while (stats.income.length <= w) stats.income.push(Object.fromEntries(SOURCES.map((k) => [k, 0])) as Record<IncomeSource, number>);
    stats.income[w]![source] += value;
  };
  const spend = (what: string, value: number) => {
    stats.spent[what] = (stats.spent[what] ?? 0) + value;
  };
  /** Earnings over the last minute, for deciding whether a big purchase is worth waiting for. */
  const recent: { at: number; value: number }[] = [];
  const incomePerS = () => {
    while (recent.length && recent[0]!.at < now() - 60) recent.shift();
    return recent.reduce((a, r) => a + r.value, 0) / 60;
  };

  const tick = () => {
    const before = s.money;
    sim.advance(TICK_MS);
    for (const e of sim.drainEvents(events)) {
      if (e.type === 'upgraded') {
        timeline.push({ seconds: now(), what: `${e.upgrade} → Lv ${e.level}`, purchase: true });
        spend(e.upgrade, upgradeCost(e.upgrade, e.level - 1));
      }
      if (e.type === 'built') {
        timeline.push({ seconds: now(), what: `built ${e.station}`, purchase: true });
        const line = factory.lines.find((l) => l.id === e.station);
        spend(line ? 'lines' : 'machines', line?.buildCost ?? shredders.find((m) => m.id === e.station)?.build?.cost ?? 0);
      }
      if (e.type === 'levelUp') {
        timeline.push({ seconds: now(), what: `business level ${e.level}`, purchase: false });
        stats.levelAt[e.level] = now();
        earn('chest', e.chest);
      }
      if (e.type === 'hired') {
        timeline.push({ seconds: now(), what: `hired employee ${e.count}`, purchase: true });
        spend('hires', STAFF.costs[e.count - 1] ?? 0);
      }
      if (e.type === 'orderFilled') {
        timeline.push({ seconds: now(), what: `order filled: ${e.item} (+$${e.value})`, purchase: false });
        earn('order', e.value);
      }
      if (e.type === 'objectiveDone') {
        timeline.push({ seconds: now(), what: `objective ${e.objective} (+$${e.reward})`, purchase: false });
        earn('objective', e.reward);
      }
      if (e.type === 'sold') {
        earn(e.staff ? 'staffSales' : isMetal(e.item) ? 'metal' : 'product', e.value);
        if (!firstSale) {
          firstSale = true;
          timeline.push({ seconds: now(), what: `first sale: ${e.item} (+$${e.value})`, purchase: false });
        }
      }
      if (e.type === 'itemMoved' && e.from === 'truck') count('delivered');
      if (e.type === 'processed') count(e.station.startsWith('line-') ? 'made' : 'shredded');
      if (e.type === 'orderFilled') count('filled');
      if (e.type === 'orderExpired') count('expired');
      if (e.type === 'found' && !found.has(e.item)) {
        found.add(e.item);
        timeline.push({ seconds: now(), what: `first ${e.item} found`, purchase: false });
      }
    }
    if (s.money > before) recent.push({ at: now(), value: s.money - before });
  };

  /** Walks to the centre of `zone` (time passes, the player is out of every zone on the way). */
  const goTo = (zone: Rect) => goToPoint(centre(zone));

  const goToPoint = (to: { x: number; y: number }) => {
    const distance = Math.hypot(to.x - s.player.x, to.y - s.player.y);
    const ticks = Math.ceil((distance / PLAYER.speed) * profile.walk * SIM.tickRate);
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
  const level = () => businessLevel(s.earned);

  /** The next big unlock open at this business level: a line slot, the second shredder, or an Extraction level. */
  const bigUnlock = (): { cost: number; zone: Rect; done: () => boolean } | undefined => {
    const line = nextUnbuiltLine(factory, s);
    if (line && level() >= (line.requiresLevel ?? 0)) {
      return { cost: line.buildCost - (s.buildPaid[line.id] ?? 0), zone: factory.zones.build, done: () => s.lines[line.id]!.built };
    }
    const machine = shredders.find((m) => m.build && !s.processors[m.id]!.built && level() >= m.build.requiresLevel);
    if (machine) {
      return { cost: machine.build!.cost - (s.buildPaid[machine.id] ?? 0), zone: machine.zones.build!, done: () => s.processors[machine.id]!.built };
    }
    // Only the Extraction levels that unlock a metal (1, 3, 5, 7) are worth saving for; the rest are ordinary upgrades.
    const ext = s.upgrades.extraction;
    if (ext % 2 === 0 && ext < UPGRADES.extraction.maxLevel && level() >= requiredLevel('extraction', ext)) {
      const pad = pads.find((p) => p.upgrade === 'extraction')!;
      return { cost: upgradeCost('extraction', ext) - s.upgradePaid.extraction, zone: pad.zones.buy, done: () => s.upgrades.extraction > ext };
    }
    return undefined;
  };

  /** The most useful affordable purchase right now, if any. */
  const nextPurchase = (): { zone: Rect; done: () => boolean } | undefined => {
    const big = bigUnlock();
    if (big && s.money >= big.cost) return big;
    // A free hire as soon as the hut opens; later ones once a line exists and there's cash to spare.
    const hireCost = STAFF.costs[s.employees.length];
    const hutOpen = level() >= STAFF.requiresLevel;
    if (hireCost !== undefined && hutOpen && (hireCost === 0 || s.lines['line-1']?.built) && s.money >= hireCost) {
      const before = s.employees.length;
      return { zone: hut.zones.hire, done: () => s.employees.length > before };
    }
    // Saving up: skip small upgrades while the big unlock is less than ~90 s of income away.
    const saving = big && (big.cost - s.money) / Math.max(1, incomePerS()) < 90;
    for (const plan of UPGRADE_PLAN) {
      const id = plan.id;
      const def = UPGRADES[id];
      const lvl = s.upgrades[id];
      const cap = Math.min(def.maxLevel, Math.floor(plan.base + plan.perLevel * level()));
      if (lvl >= cap) continue;
      if (plan.needsStaff && s.employees.length === 0) continue;
      if (level() < requiredLevel(id, lvl)) continue;
      if (def.requiresLine && !s.lines[def.requiresLine]?.built) continue;
      const cost = upgradeCost(id, lvl) - s.upgradePaid[id];
      if (saving && s.money - cost < big!.cost) continue;
      if (s.money >= cost) {
        const pad = pads.find((p) => p.upgrade === id)!;
        return { zone: pad.zones.buy, done: () => s.upgrades[id] > lvl };
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

  const builtShredders = () => shredders.filter((m) => s.processors[m.id]!.built);
  const hopperRoom = (m: ProcessorDef) => hopperCapacity(m, s) - s.processors[m.id]!.hopper;

  while (s.tick < endTick) {
    if (profile.pauseS > 0) stand(() => false, profile.pauseS);
    planLines();
    const product = s.player.stack.find((i) => isProduct(i));
    if (product) {
      const bay = truckWanting(product);
      if (bay) {
        goTo(bay.zones.load);
        stand(() => !carrying(product) || s.bays[bay.id]!.phase !== 'waiting', 4);
      } else {
        goTo(outlet.zones.sell);
        stand(() => !s.player.stack.some((i) => isProduct(i)), 4);
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
      // Worth storing: what the lines use, and what waiting trucks' products need (Auto lines switch to them).
      for (const b of bayDefs) {
        const bay = s.bays[b.id]!;
        if (bay.phase === 'waiting' && bay.item && isProduct(bay.item)) for (const m of recipeMetals(bay.item)) used.add(m);
      }
      const storable = (m: ItemId) => used.has(m) && s.bins[binOf(m).id]!.count < binCapacity(binOf(m), s);
      if (storable(metal)) {
        const bin = binOf(metal);
        goTo(bin.zones.deposit);
        stand(() => !carrying(metal) || s.bins[bin.id]!.count >= binCapacity(bin, s), 4);
      } else {
        // Everything no line needs, or with a full bin, goes to the Scrap Dealer.
        goTo(dealer.zones.sell);
        stand(() => !s.player.stack.some((i) => isMetal(i) && !storable(i)), 4);
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
      const target = builtShredders().reduce((a, b) => (hopperRoom(b) > hopperRoom(a) ? b : a));
      goTo(target.zones.input);
      stand(() => !carrying('scrap') || hopperRoom(target) <= 0, 4);
      if (carrying('scrap') && builtShredders().every((m) => hopperRoom(m) <= 0)) {
        goTo(dump.zones.return);
        stand(() => !carrying('scrap'), 4);
      }
      continue;
    }
    const tray = builtShredders().filter((m) => trayTotal(s.processors[m.id]!) > 0).sort((a, b) => trayTotal(s.processors[b.id]!) - trayTotal(s.processors[a.id]!))[0];
    if (tray) {
      goTo(tray.zones.output);
      stand(() => s.player.stack.length >= carryCapacity(s) || trayTotal(s.processors[tray.id]!) === 0, 4);
      continue;
    }
    if (s.field.pieces.length > 0 && builtShredders().some((m) => hopperRoom(m) > 0)) {
      // Sweep the field: walk to the nearest piece that fits, until the hands are full.
      for (let n = 0; n < 40 && s.tick < endTick; n++) {
        const room = carryCapacity(s) - s.player.stack.length;
        let best: { x: number; y: number } | undefined;
        let bestD = Infinity;
        for (const p of s.field.pieces) {
          if (PIECE_KINDS[p.kind]!.units > room || p.locked) continue;
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
  void BUSINESS_LEVELS;
  return { timeline, stats };
}

/** Pacing stats between `fromMin` and `toMin`: gaps between purchases, in seconds. */
export function purchaseGaps(
  timeline: readonly TimelineEntry[],
  toMin: number,
  fromMin = 0,
): { count: number; average: number; longest: number } {
  const times = timeline.filter((e) => e.purchase && e.seconds <= toMin * 60 && e.seconds >= fromMin * 60).map((e) => e.seconds);
  const gaps = times.map((t, i) => t - (times[i - 1] ?? fromMin * 60));
  return {
    count: times.length,
    average: gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : Infinity,
    longest: gaps.length ? Math.max(...gaps, toMin * 60 - (times.at(-1) ?? 0)) : Infinity,
  };
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
