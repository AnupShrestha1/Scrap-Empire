// The Milestone 1 objective chain. The first steps teach the loop; the rest pace the early game.
// Each objective counts matching sim events, or checks the state for things already done.
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

export const OBJECTIVES: readonly ObjectiveDef[] = [
  {
    id: 'pickScrap',
    target: 1,
    reward: 5,
    counts: (e) => +(e.type === 'itemMoved' && e.item === 'scrap' && e.from === 'dump' && e.to === 'player'),
    hint: { station: 'dump', zone: 'field' },
  },
  {
    id: 'feedShredder',
    target: 3,
    reward: 5,
    counts: (e) => +(e.type === 'itemMoved' && e.to === 'shredder'),
    hint: { station: 'shredder', zone: 'input' },
  },
  {
    id: 'collectMetal',
    target: 1,
    reward: 5,
    counts: (e) => +(e.type === 'itemMoved' && e.from === 'shredder' && e.to === 'player'),
    hint: { station: 'shredder', zone: 'output' },
  },
  {
    id: 'sortMetal',
    target: 3,
    reward: 10,
    counts: (e) => +(e.type === 'itemMoved' && e.from === 'player' && e.to.startsWith('bin-')),
    hint: { station: 'bin-iron', zone: 'deposit' },
  },
  {
    id: 'sellIron',
    target: 10,
    reward: 15,
    counts: (e) => +(e.type === 'sold' && e.item === 'iron'),
    hint: { station: 'bin-iron', zone: 'sell' },
  },
  {
    id: 'buyCarry',
    target: 1,
    reward: 20,
    done: (s) => s.upgrades.carry > 0,
    hint: { station: 'pad-carry', zone: 'buy' },
  },
  {
    id: 'shred30',
    target: 30,
    reward: 25,
    counts: (e) => +(e.type === 'processed' && e.station === 'shredder'),
    hint: { station: 'shredder', zone: 'input' },
  },
  {
    id: 'secondUpgrade',
    target: 1,
    reward: 40,
    done: (s) => s.upgrades.shredderSpeed + s.upgrades.binSize + s.upgrades.supply > 0,
    hint: { station: 'pad-shredder', zone: 'buy' },
  },
  {
    id: 'buildPress',
    target: 1,
    reward: 50,
    done: (s) => s.lines.press?.built === true,
    hint: { station: 'factory', zone: 'build' },
  },
  {
    id: 'makeSheets',
    target: 10,
    reward: 60,
    counts: (e) => +(e.type === 'processed' && e.station === 'press'),
    hint: { station: 'bin-iron', zone: 'deposit' },
  },
  {
    id: 'reachLevel2',
    target: 1,
    reward: 40,
    done: (s) => businessLevel(s.earned) >= 2,
  },
  {
    id: 'buildCanLine',
    target: 1,
    reward: 100,
    done: (s) => s.lines['can-line']?.built === true,
    hint: { station: 'factory', zone: 'build' },
  },
  {
    id: 'unlockCopper',
    target: 1,
    reward: 150,
    done: (s) => s.upgrades.extraction > 0,
    hint: { station: 'pad-extraction', zone: 'buy' },
  },
  {
    id: 'reachLevel4',
    target: 1,
    reward: 250,
    done: (s) => businessLevel(s.earned) >= 4,
  },
];
