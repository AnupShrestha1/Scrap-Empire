// The objective chain (docs/PROGRESSION.md §3). The first steps teach the loop within a minute; later ones
// point at each new unlock. Each objective counts matching sim events, or checks the state for things
// already done.
import { isMetal } from './items';
import type { SimEvent } from '../sim/events';
import type { GameState } from '../sim/state';
import { businessLevel } from './balance';

export interface ObjectiveDef {
  id: string;
  /** How many matching events complete it. */
  target: number;
  reward: number;
  /** How much an event counts towards the target (usually 0 or 1). */
  counts?: (e: SimEvent) => number;
  /** Already satisfied by the current state (e.g. an upgrade bought earlier). */
  done?: (s: GameState) => boolean;
  /** Where the hint arrow points: a station and one of its zones. */
  hint?: { station: string; zone: string };
}

const level = (n: number) => (s: GameState) => businessLevel(s.earned) >= n;
const extraction = (n: number) => (s: GameState) => s.upgrades.extraction >= n;

export const OBJECTIVES: readonly ObjectiveDef[] = [
  {
    id: 'pickScrap',
    target: 1,
    reward: 10,
    counts: (e) => +(e.type === 'itemMoved' && e.item === 'scrap' && e.from === 'dump' && e.to === 'player'),
    hint: { station: 'dump', zone: 'field' },
  },
  {
    id: 'feedShredder',
    target: 3,
    reward: 10,
    counts: (e) => +(e.type === 'itemMoved' && e.to === 'shredder' && e.from === 'player'),
    hint: { station: 'shredder', zone: 'input' },
  },
  {
    id: 'collectMetal',
    target: 1,
    reward: 10,
    counts: (e) => +(e.type === 'itemMoved' && e.from === 'shredder' && e.to === 'player'),
    hint: { station: 'shredder', zone: 'output' },
  },
  {
    id: 'sellIron',
    target: 3,
    reward: 20,
    counts: (e) => +(e.type === 'sold' && e.station === 'dealer'),
    hint: { station: 'dealer', zone: 'sell' },
  },
  { id: 'buyCarry', target: 1, reward: 20, done: (s) => s.upgrades.carry > 0, hint: { station: 'pad-carry', zone: 'buy' } },
  {
    id: 'shred20',
    target: 20,
    reward: 40,
    counts: (e) => +(e.type === 'processed' && e.station === 'shredder'),
    hint: { station: 'shredder', zone: 'input' },
  },
  { id: 'buyMagnet', target: 1, reward: 40, done: (s) => s.upgrades.magnet > 0, hint: { station: 'pad-magnet', zone: 'buy' } },
  { id: 'reachLevel2', target: 1, reward: 80, done: level(2) },
  { id: 'hireFirst', target: 1, reward: 60, done: (s) => s.employees.length > 0, hint: { station: 'staff-hut', zone: 'hire' } },
  {
    id: 'secondUpgrade',
    target: 1,
    reward: 100,
    done: (s) => s.upgrades.shredderSpeed + s.upgrades.binSize + s.upgrades.supply > 0,
    hint: { station: 'pad-shredder', zone: 'buy' },
  },
  { id: 'reachLevel3', target: 1, reward: 150, done: level(3) },
  { id: 'buildLine', target: 1, reward: 200, done: (s) => s.lines['line-1']?.built === true, hint: { station: 'factory', zone: 'build' } },
  {
    id: 'storeMetal',
    target: 5,
    reward: 40,
    counts: (e) => +(e.type === 'itemMoved' && e.from === 'player' && e.to.startsWith('bin-') && isMetal(e.item)),
    hint: { station: 'bin-iron', zone: 'deposit' },
  },
  {
    id: 'makeProducts',
    target: 10,
    reward: 200,
    counts: (e) => +(e.type === 'processed' && e.station.startsWith('line-')),
    hint: { station: 'bin-iron', zone: 'deposit' },
  },
  { id: 'fillOrder', target: 1, reward: 300, counts: (e) => +(e.type === 'orderFilled'), hint: { station: 'bay-a', zone: 'load' } },
  { id: 'unlockCopper', target: 1, reward: 400, done: extraction(1), hint: { station: 'pad-extraction', zone: 'buy' } },
  { id: 'secondLine', target: 1, reward: 600, done: (s) => s.lines['line-2']?.built === true, hint: { station: 'factory', zone: 'build' } },
  { id: 'reachLevel5', target: 1, reward: 1000, done: level(5) },
  { id: 'unlockTitanium', target: 1, reward: 1500, done: extraction(3), hint: { station: 'pad-extraction', zone: 'buy' } },
  { id: 'reachLevel6', target: 1, reward: 3000, done: level(6) },
  { id: 'unlockGold', target: 1, reward: 5000, done: extraction(5), hint: { station: 'pad-extraction', zone: 'buy' } },
  { id: 'reachLevel7', target: 1, reward: 10000, done: level(7) },
  { id: 'unlockPlatinum', target: 1, reward: 20000, done: extraction(7), hint: { station: 'pad-extraction', zone: 'buy' } },
];

/** After the chain: goals that cycle through these, each round bigger and better paid. */
const GOALS: readonly { id: string; target: number; counts: (e: SimEvent) => number }[] = [
  { id: 'goalOrders', target: 4, counts: (e) => +(e.type === 'orderFilled') },
  { id: 'goalShred', target: 150, counts: (e) => +(e.type === 'processed' && e.station === 'shredder') },
  { id: 'goalProducts', target: 40, counts: (e) => +(e.type === 'processed' && e.station.startsWith('line-')) },
  { id: 'goalRare', target: 6, counts: (e) => +(e.type === 'found' && e.item !== 'aluminium' && e.item !== 'copper') },
];

/** The `n`th goal after the chain (0-based). */
export function rotatingGoal(n: number): ObjectiveDef {
  const goal = GOALS[n % GOALS.length]!;
  const round = Math.floor(n / GOALS.length);
  return {
    id: goal.id,
    target: Math.round(goal.target * (1 + round * 0.5)),
    reward: Math.round((5000 * 1.5 ** round) / 100) * 100,
    counts: goal.counts,
  };
}
